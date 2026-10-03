ALTER TABLE monitoring_records 
ADD COLUMN phil_iri_score NUMERIC(5,2) NULL,
ADD COLUMN crla_score NUMERIC(5,2) NULL,
ADD COLUMN has_parental_consent BOOLEAN DEFAULT FALSE NOT NULL;
