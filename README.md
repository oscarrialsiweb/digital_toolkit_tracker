### 🧠 Nombre del proyecto: **Kit Digital Tracker**

### 📝 Descripción general

Desarrollar una aplicación web con backend en JavaScript (Node.js + Express) y frontend en React. La finalidad es automatizar la descarga y procesamiento de resoluciones publicadas en la sede de Red.es en formato PDF, que contienen tablas con los códigos de expediente del programa Kit Digital. La app cotejará estos datos con una base de datos MySQL propia, que ya contiene los expedientes de nuestros clientes.

---

### 🧩 Funcionalidades clave

#### 📥 Descarga y procesamiento de PDFs
- Descarga automática (o bajo demanda) de los documentos PDF desde:  
  `https://sede.red.gob.es/es/procedimientos/convocatoria-de-ayudas-destinadas-la-digitalizacion-de-empresas-del-segmento-iii`
- Solo se procesarán los documentos que contengan las siguientes tablas:
  - Resoluciones de Concesión
  - Resoluciones de Desistidos
  - Resoluciones de Desistimiento Expreso (Renuncia a la solicitud)
  - Resoluciones de Inadmitidos
- Extracción de códigos de expediente desde las tablas PDF.
- Identificación del estado del expediente en función de la tabla de origen.
- Cruce con la base de datos para comprobar si el expediente pertenece a uno de nuestros clientes.

#### 🧾 Base de datos
- Base de datos **MySQL** con los expedientes de nuestros clientes.
- Estructura básica esperada:
  - `codigo_expediente` (clave)
  - `estado` (concedido, pendiente, desistido, etc.)
  - `fecha_creacion`
  - `origen` (canarias / península)
  - otros datos de interés (nombre, NIF, etc.)

#### 📊 Interfaz de usuario (Frontend)
- Panel resumen con:
  - Total de expedientes revisados
  - Cuántos pertenecen a nuestra base de datos
  - Cuántos están en estado “concedido”
  - Cuántos en otros estados
- Filtros y visualización por:
  - **Mes de creación del cliente**
  - **Origen** (Canarias o Península)
- Opción para subir manualmente un PDF en caso necesario

---

### ⚙️ Parámetros de configuración (en `.env`)
```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=usuario
DB_PASSWORD=clave
DB_NAME=kit_digital
PDF_DOWNLOAD_URL=https://sede.red.gob.es/es/procedimientos/convocatoria-de-ayudas-destinadas-la-digitalizacion-de-empresas-del-segmento-iii
```

---

### 💡 Stack tecnológico propuesto

- **Frontend**: React.js + Tailwind CSS
- **Backend**: Node.js + Express
- **Base de datos**: MySQL
- **Procesamiento de PDFs**: `pdf-parse`, `pdf-lib`, o integración con herramientas como `tabula` si es necesario extraer tablas de forma precisa
- **Deploy**: En Replit para desarrollo, con posibilidad de migración futura a Render, Railway o VPS propio
