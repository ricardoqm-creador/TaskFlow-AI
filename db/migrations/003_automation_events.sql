-- Migración 003: cola de eventos para automatizaciones (n8n)
-- El backend inserta una fila por cada evento de negocio (task.created, task.deleted...)
-- en la MISMA transacción que el cambio de datos, y después envía el webhook.
-- Así ningún evento se pierde y los fallos pueden reintentarse.
BEGIN;

CREATE TABLE automation_events (
    id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    event_type       VARCHAR(60)  NOT NULL,           -- p. ej. 'task.created'
    entity_type      VARCHAR(30)  NOT NULL,           -- p. ej. 'task'
    entity_id        BIGINT,                          -- sin FK a propósito: el registro debe sobrevivir al borrado
    payload          JSONB        NOT NULL DEFAULT '{}'::jsonb,
    dedupe_key       VARCHAR(120),                    -- evita procesar dos veces el mismo evento
    status           VARCHAR(12)  NOT NULL DEFAULT 'pending',
    attempts         INTEGER      NOT NULL DEFAULT 0,
    last_error       VARCHAR(500),
    next_attempt_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    processed_at     TIMESTAMPTZ,
    CONSTRAINT ae_event_type_not_blank CHECK (length(btrim(event_type)) > 0),
    CONSTRAINT ae_status_check   CHECK (status IN ('pending', 'processing', 'processed', 'failed')),
    CONSTRAINT ae_attempts_check CHECK (attempts >= 0),
    CONSTRAINT ae_dedupe_uq UNIQUE (dedupe_key)
);

-- Cola de trabajo: solo los eventos que aún hay que procesar.
CREATE INDEX ae_queue_idx ON automation_events (next_attempt_at)
    WHERE status IN ('pending', 'failed');
CREATE INDEX ae_entity_idx ON automation_events (entity_type, entity_id);

COMMIT;
