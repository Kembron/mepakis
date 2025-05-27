# Manual Técnico - Sistema de Gestión de Cuidadores

## Arquitectura del Sistema

### Stack Tecnológico
- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Server Actions
- **Base de datos**: MySQL
- **Autenticación**: JWT con cookies httpOnly
- **Mapas**: Leaflet/OpenStreetMap

### Estructura de la Base de Datos

#### Tablas Principales
1. **users**: Administradores y trabajadores
2. **locations**: Domicilios de pacientes
3. **check_in_records**: Registros de entrada/salida
4. **documents**: Documentos para firma
5. **document_signatures**: Firmas de documentos
6. **worker_signatures**: Firmas guardadas de trabajadores

### Configuración del Servidor

#### Requisitos Mínimos
- Node.js 18+
- MySQL 8.0+
- 2GB RAM
- 10GB almacenamiento

#### Variables de Entorno
\`\`\`bash
MYSQL_HOST=localhost
MYSQL_USER=root
MYSQL_PASSWORD=password
MYSQL_DATABASE=cuidadores_app
JWT_SECRET=your-secret-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
\`\`\`

### Mantenimiento

#### Tareas Diarias
- Verificar logs de errores
- Monitorear uso de almacenamiento
- Backup automático de base de datos

#### Tareas Semanales
- Limpiar archivos temporales
- Verificar integridad de documentos
- Actualizar estadísticas

#### Tareas Mensuales
- Optimizar base de datos
- Revisar usuarios inactivos
- Generar reportes de uso

### Escalabilidad

#### Límites Actuales
- **Trabajadores**: 50 usuarios simultáneos
- **Documentos**: 100 PDFs (500MB total)
- **Registros**: 10,000 entradas sin degradación

#### Mejoras Futuras
- Migrar a Vercel Blob para documentos
- Implementar Redis para caché
- Añadir CDN para archivos estáticos
