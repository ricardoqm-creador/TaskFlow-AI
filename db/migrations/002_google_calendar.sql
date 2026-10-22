-- Migración: integración con Google Calendar (ejecutar después de schema.sql)
BEGIN;

-- Una conexión por usuario y proveedor. Los tokens se guardan CIFRADOS (AES-256-GCM) por la app.
CREATE TABLE integrations (
    id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id           BIGINT      NOT NULL,
    provider          VARCHAR(30) NOT NULL DEFAULT 'google_calendar',
    refresh_token_enc TEXT        NOT NULL,
    access_token_enc  TEXT,
    expiry_date       BIGINT,                       -- epoch en milisegundos
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT integrations_provider_check CHECK (provider IN ('google_calendar')),
    CONSTRAINT integrations_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT integrations_user_provider_uq UNIQUE (user_id, provider)
);

-- Vínculo tarea <-> evento de Google.
CREATE TABLE task_calendar_events (
    task_id         BIGINT       PRIMARY KEY,
    user_id         BIGINT       NOT NULL,
    google_event_id VARCHAR(100) NOT NULL,
    html_link       VARCHAR(500),
    synced_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT tce_task_fk FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE,
    CONSTRAINT tce_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);
CREATE INDEX tce_user_idx ON task_calendar_events (user_id);

CREATE TRIGGER integrations_set_updated_at BEFORE UPDATE ON integrations
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;
