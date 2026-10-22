-- =====================================================================
-- TaskFlow AI - Esquema relacional (PostgreSQL 13+)
-- =====================================================================
-- Convenciones:
--   * Tablas y columnas en snake_case, tablas en plural.
--   * PK: BIGINT GENERATED ALWAYS AS IDENTITY (tablas puente: PK compuesta).
--   * Fechas en TIMESTAMPTZ (UTC).
--   * Valores de catalogo con CHECK en lugar de ENUM (mas facil de migrar).
--   * ON DELETE: CASCADE en datos dependientes; RESTRICT en autoria/propiedad.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- Funcion para mantener updated_at
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------
CREATE TABLE users (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name           VARCHAR(100) NOT NULL,
    email          VARCHAR(255) NOT NULL,
    password_hash  VARCHAR(255) NOT NULL,
    avatar_url     VARCHAR(500),
    is_active      BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT users_name_not_blank  CHECK (length(btrim(name)) > 0),
    CONSTRAINT users_email_format    CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);
-- Email unico sin distinguir mayusculas
CREATE UNIQUE INDEX users_email_uq ON users (lower(email));

-- ---------------------------------------------------------------------
-- workspaces
-- ---------------------------------------------------------------------
CREATE TABLE workspaces (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name        VARCHAR(120) NOT NULL,
    owner_id    BIGINT       NOT NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT workspaces_name_not_blank CHECK (length(btrim(name)) > 0),
    CONSTRAINT workspaces_owner_fk FOREIGN KEY (owner_id)
        REFERENCES users (id) ON DELETE RESTRICT
);
CREATE INDEX workspaces_owner_idx ON workspaces (owner_id);

-- ---------------------------------------------------------------------
-- workspace_members (N:M users <-> workspaces)
-- ---------------------------------------------------------------------
CREATE TABLE workspace_members (
    workspace_id  BIGINT      NOT NULL,
    user_id       BIGINT      NOT NULL,
    role          VARCHAR(10) NOT NULL DEFAULT 'member',
    joined_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (workspace_id, user_id),
    CONSTRAINT wm_role_check CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
    CONSTRAINT wm_workspace_fk FOREIGN KEY (workspace_id)
        REFERENCES workspaces (id) ON DELETE CASCADE,
    CONSTRAINT wm_user_fk FOREIGN KEY (user_id)
        REFERENCES users (id) ON DELETE CASCADE
);
CREATE INDEX wm_user_idx ON workspace_members (user_id);

-- ---------------------------------------------------------------------
-- projects
-- ---------------------------------------------------------------------
CREATE TABLE projects (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    workspace_id  BIGINT       NOT NULL,
    name          VARCHAR(120) NOT NULL,
    description   TEXT,
    status        VARCHAR(10)  NOT NULL DEFAULT 'active',
    created_by    BIGINT       NOT NULL,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT projects_name_not_blank CHECK (length(btrim(name)) > 0),
    CONSTRAINT projects_status_check   CHECK (status IN ('active', 'archived')),
    CONSTRAINT projects_workspace_fk FOREIGN KEY (workspace_id)
        REFERENCES workspaces (id) ON DELETE CASCADE,
    CONSTRAINT projects_created_by_fk FOREIGN KEY (created_by)
        REFERENCES users (id) ON DELETE RESTRICT,
    CONSTRAINT projects_ws_name_uq UNIQUE (workspace_id, name)
);
CREATE INDEX projects_created_by_idx ON projects (created_by);

-- ---------------------------------------------------------------------
-- task_statuses (columnas del tablero, por proyecto)
-- ---------------------------------------------------------------------
CREATE TABLE task_statuses (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    project_id  BIGINT      NOT NULL,
    name        VARCHAR(60) NOT NULL,
    position    INTEGER     NOT NULL DEFAULT 0,
    is_done     BOOLEAN     NOT NULL DEFAULT FALSE,
    CONSTRAINT ts_name_not_blank CHECK (length(btrim(name)) > 0),
    CONSTRAINT ts_position_check CHECK (position >= 0),
    CONSTRAINT ts_project_fk FOREIGN KEY (project_id)
        REFERENCES projects (id) ON DELETE CASCADE,
    CONSTRAINT ts_project_name_uq UNIQUE (project_id, name),
    -- Permite que tasks verifique que el estado pertenece a su mismo proyecto
    CONSTRAINT ts_id_project_uq UNIQUE (id, project_id)
);

-- ---------------------------------------------------------------------
-- tasks
-- ---------------------------------------------------------------------
CREATE TABLE tasks (
    id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    project_id         BIGINT       NOT NULL,
    status_id          BIGINT       NOT NULL,
    parent_task_id     BIGINT,
    title              VARCHAR(200) NOT NULL,
    description        TEXT,
    priority           VARCHAR(10)  NOT NULL DEFAULT 'medium',
    due_date           DATE,
    estimated_minutes  INTEGER,
    created_by         BIGINT       NOT NULL,
    created_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
    completed_at       TIMESTAMPTZ,
    CONSTRAINT tasks_title_not_blank CHECK (length(btrim(title)) > 0),
    CONSTRAINT tasks_priority_check  CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    CONSTRAINT tasks_estimate_check  CHECK (estimated_minutes IS NULL OR estimated_minutes >= 0),
    CONSTRAINT tasks_not_own_parent  CHECK (parent_task_id IS NULL OR parent_task_id <> id),
    CONSTRAINT tasks_completed_check CHECK (completed_at IS NULL OR completed_at >= created_at),
    CONSTRAINT tasks_project_fk FOREIGN KEY (project_id)
        REFERENCES projects (id) ON DELETE CASCADE,
    -- Garantiza que el estado pertenezca al mismo proyecto que la tarea
    CONSTRAINT tasks_status_fk FOREIGN KEY (status_id, project_id)
        REFERENCES task_statuses (id, project_id) ON DELETE RESTRICT,
    CONSTRAINT tasks_parent_fk FOREIGN KEY (parent_task_id)
        REFERENCES tasks (id) ON DELETE CASCADE,
    CONSTRAINT tasks_created_by_fk FOREIGN KEY (created_by)
        REFERENCES users (id) ON DELETE RESTRICT
);
CREATE INDEX tasks_project_status_idx ON tasks (project_id, status_id);
CREATE INDEX tasks_parent_idx         ON tasks (parent_task_id) WHERE parent_task_id IS NOT NULL;
CREATE INDEX tasks_due_date_idx       ON tasks (due_date)       WHERE completed_at IS NULL;
CREATE INDEX tasks_created_by_idx     ON tasks (created_by);

-- ---------------------------------------------------------------------
-- task_assignees (N:M tasks <-> users)
-- ---------------------------------------------------------------------
CREATE TABLE task_assignees (
    task_id      BIGINT      NOT NULL,
    user_id      BIGINT      NOT NULL,
    assigned_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (task_id, user_id),
    CONSTRAINT ta_task_fk FOREIGN KEY (task_id)
        REFERENCES tasks (id) ON DELETE CASCADE,
    CONSTRAINT ta_user_fk FOREIGN KEY (user_id)
        REFERENCES users (id) ON DELETE CASCADE
);
CREATE INDEX ta_user_idx ON task_assignees (user_id);

-- ---------------------------------------------------------------------
-- labels
-- ---------------------------------------------------------------------
CREATE TABLE labels (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    workspace_id  BIGINT      NOT NULL,
    name          VARCHAR(50) NOT NULL,
    color         CHAR(7)     NOT NULL DEFAULT '#808080',
    CONSTRAINT labels_name_not_blank CHECK (length(btrim(name)) > 0),
    CONSTRAINT labels_color_check    CHECK (color ~ '^#[0-9A-Fa-f]{6}$'),
    CONSTRAINT labels_workspace_fk FOREIGN KEY (workspace_id)
        REFERENCES workspaces (id) ON DELETE CASCADE,
    CONSTRAINT labels_ws_name_uq UNIQUE (workspace_id, name)
);

-- ---------------------------------------------------------------------
-- task_labels (N:M tasks <-> labels)
-- ---------------------------------------------------------------------
CREATE TABLE task_labels (
    task_id   BIGINT NOT NULL,
    label_id  BIGINT NOT NULL,
    PRIMARY KEY (task_id, label_id),
    CONSTRAINT tl_task_fk FOREIGN KEY (task_id)
        REFERENCES tasks (id) ON DELETE CASCADE,
    CONSTRAINT tl_label_fk FOREIGN KEY (label_id)
        REFERENCES labels (id) ON DELETE CASCADE
);
CREATE INDEX tl_label_idx ON task_labels (label_id);

-- ---------------------------------------------------------------------
-- comments
-- ---------------------------------------------------------------------
CREATE TABLE comments (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    task_id     BIGINT      NOT NULL,
    user_id     BIGINT      NOT NULL,
    body        TEXT        NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT comments_body_not_blank CHECK (length(btrim(body)) > 0),
    CONSTRAINT comments_task_fk FOREIGN KEY (task_id)
        REFERENCES tasks (id) ON DELETE CASCADE,
    CONSTRAINT comments_user_fk FOREIGN KEY (user_id)
        REFERENCES users (id) ON DELETE RESTRICT
);
CREATE INDEX comments_task_idx ON comments (task_id, created_at);
CREATE INDEX comments_user_idx ON comments (user_id);

-- ---------------------------------------------------------------------
-- attachments
-- ---------------------------------------------------------------------
CREATE TABLE attachments (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    task_id      BIGINT       NOT NULL,
    uploaded_by  BIGINT       NOT NULL,
    file_name    VARCHAR(255) NOT NULL,
    file_url     VARCHAR(500) NOT NULL,
    size_bytes   BIGINT,
    uploaded_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT attachments_size_check CHECK (size_bytes IS NULL OR size_bytes >= 0),
    CONSTRAINT attachments_task_fk FOREIGN KEY (task_id)
        REFERENCES tasks (id) ON DELETE CASCADE,
    CONSTRAINT attachments_user_fk FOREIGN KEY (uploaded_by)
        REFERENCES users (id) ON DELETE RESTRICT
);
CREATE INDEX attachments_task_idx ON attachments (task_id);
CREATE INDEX attachments_user_idx ON attachments (uploaded_by);

-- ---------------------------------------------------------------------
-- time_entries
-- ---------------------------------------------------------------------
CREATE TABLE time_entries (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    task_id     BIGINT      NOT NULL,
    user_id     BIGINT      NOT NULL,
    started_at  TIMESTAMPTZ NOT NULL,
    ended_at    TIMESTAMPTZ,
    minutes     INTEGER,
    CONSTRAINT te_end_after_start CHECK (ended_at IS NULL OR ended_at >= started_at),
    CONSTRAINT te_minutes_check   CHECK (minutes IS NULL OR minutes >= 0),
    CONSTRAINT te_task_fk FOREIGN KEY (task_id)
        REFERENCES tasks (id) ON DELETE CASCADE,
    CONSTRAINT te_user_fk FOREIGN KEY (user_id)
        REFERENCES users (id) ON DELETE CASCADE
);
CREATE INDEX te_task_idx ON time_entries (task_id);
CREATE INDEX te_user_idx ON time_entries (user_id, started_at);

-- ---------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------
CREATE TABLE notifications (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id     BIGINT       NOT NULL,
    task_id     BIGINT,
    type        VARCHAR(40)  NOT NULL,
    message     VARCHAR(300) NOT NULL,
    is_read     BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT notifications_message_not_blank CHECK (length(btrim(message)) > 0),
    CONSTRAINT notifications_user_fk FOREIGN KEY (user_id)
        REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT notifications_task_fk FOREIGN KEY (task_id)
        REFERENCES tasks (id) ON DELETE CASCADE
);
CREATE INDEX notifications_user_unread_idx ON notifications (user_id, created_at DESC)
    WHERE is_read = FALSE;
CREATE INDEX notifications_task_idx ON notifications (task_id) WHERE task_id IS NOT NULL;

-- ---------------------------------------------------------------------
-- ai_suggestions (funciones de IA: prioridad, subtareas, resumen, estimacion)
-- ---------------------------------------------------------------------
CREATE TABLE ai_suggestions (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    task_id       BIGINT      NOT NULL,
    requested_by  BIGINT      NOT NULL,
    kind          VARCHAR(10) NOT NULL,
    prompt        TEXT,
    response      TEXT        NOT NULL,
    model         VARCHAR(60),
    status        VARCHAR(10) NOT NULL DEFAULT 'pending',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ai_kind_check   CHECK (kind IN ('priority', 'subtasks', 'summary', 'estimate')),
    CONSTRAINT ai_status_check CHECK (status IN ('pending', 'accepted', 'rejected')),
    CONSTRAINT ai_task_fk FOREIGN KEY (task_id)
        REFERENCES tasks (id) ON DELETE CASCADE,
    CONSTRAINT ai_user_fk FOREIGN KEY (requested_by)
        REFERENCES users (id) ON DELETE RESTRICT
);
CREATE INDEX ai_task_idx ON ai_suggestions (task_id, created_at DESC);
CREATE INDEX ai_user_idx ON ai_suggestions (requested_by);

-- ---------------------------------------------------------------------
-- Triggers updated_at
-- ---------------------------------------------------------------------
CREATE TRIGGER users_set_updated_at      BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER workspaces_set_updated_at BEFORE UPDATE ON workspaces
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER projects_set_updated_at   BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER tasks_set_updated_at      BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER comments_set_updated_at   BEFORE UPDATE ON comments
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;
