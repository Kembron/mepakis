-- Tabla para almacenar las firmas de los trabajadores
CREATE TABLE IF NOT EXISTS worker_signatures (
  id INT AUTO_INCREMENT PRIMARY KEY,
  worker_id INT NOT NULL,
  signature_data LONGTEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (worker_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Tabla para almacenar los documentos
CREATE TABLE IF NOT EXISTS documents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  file_path VARCHAR(255) NOT NULL,
  status ENUM('pending', 'signed', 'expired') NOT NULL DEFAULT 'pending',
  admin_id INT NOT NULL,
  worker_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  expiration_date DATE,
  FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (worker_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Tabla para almacenar los documentos firmados
CREATE TABLE IF NOT EXISTS document_signatures (
  id INT AUTO_INCREMENT PRIMARY KEY,
  document_id INT NOT NULL,
  worker_id INT NOT NULL,
  signature_id INT NOT NULL,
  signed_file_path VARCHAR(255) NOT NULL,
  signed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
  FOREIGN KEY (worker_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (signature_id) REFERENCES worker_signatures(id) ON DELETE CASCADE
);
