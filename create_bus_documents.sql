CREATE TABLE IF NOT EXISTS bus_documents (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  bus_id VARCHAR NOT NULL,
  doc_type TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  uploaded_at TIMESTAMP DEFAULT NOW(),
  notes TEXT
);

GRANT ALL PRIVILEGES ON TABLE bus_documents TO "Galaxias";
