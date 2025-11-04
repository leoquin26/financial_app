# 💰 FinanzaPro - Sistema Financiero Personal Avanzado

Una aplicación web moderna y robusta para la gestión de finanzas personales con capacidades en tiempo real, construida con React, Node.js, y WebSockets.

## 🚀 Características Principales

### 🎯 Funcionalidades Core
- **Dashboard en Tiempo Real**: Visualización instantánea de ingresos, gastos y balance
- **Gestión de Transacciones**: CRUD completo con filtros avanzados
- **Presupuestos Inteligentes**: Alertas automáticas cuando se exceden límites
- **Análisis Financiero**: Gráficos interactivos y tendencias
- **Categorías Personalizables**: Organización flexible de gastos e ingresos
- **Multi-usuario**: Sistema completo de autenticación y autorización

### ⚡ Características en Tiempo Real
- **WebSocket Integration**: Actualizaciones instantáneas sin refrescar
- **Notificaciones Push**: Alertas de presupuesto en tiempo real
- **Sincronización Multi-dispositivo**: Los cambios se reflejan instantáneamente
- **Estado de Conexión**: Indicador visual de conexión activa

### 📊 Visualización de Datos
- **Gráficos Interactivos**: Charts con Recharts
- **Tendencias Mensuales**: Análisis de patrones de gasto
- **Distribución por Categorías**: Gráficos de torta y barras
- **Comparativas**: Mes actual vs anterior

## 🛠️ Stack Tecnológico

### Backend
- **Node.js + Express**: Servidor robusto y escalable
- **Socket.io**: Comunicación en tiempo real
- **SQLite3**: Base de datos relacional
- **JWT**: Autenticación segura
- **Bcrypt**: Encriptación de contraseñas
- **Express Validator**: Validación de datos
- **Helmet**: Seguridad HTTP
- **Rate Limiting**: Protección contra ataques

### Frontend
- **React 18 + TypeScript**: Framework moderno con tipado fuerte
- **Material-UI (MUI)**: Componentes de diseño profesional
- **React Query (TanStack)**: Gestión de estado del servidor
- **React Router v6**: Navegación SPA
- **Socket.io Client**: Cliente WebSocket
- **Recharts**: Gráficos y visualizaciones
- **React Hook Form**: Manejo de formularios
- **Framer Motion**: Animaciones fluidas
- **Date-fns**: Manejo de fechas
- **React Hot Toast**: Notificaciones elegantes

## 📁 Estructura del Proyecto

```
financial_app/
├── server/                    # Backend Node.js
│   ├── index.js              # Servidor principal con Socket.io
│   ├── database/             
│   │   └── db.js            # Configuración SQLite + esquemas
│   ├── routes/              
│   │   ├── auth.js          # Autenticación y registro
│   │   ├── transactions.js  # API de transacciones
│   │   ├── categories.js    # API de categorías
│   │   ├── budgets.js       # API de presupuestos
│   │   └── dashboard.js     # API de dashboard y análisis
│   └── middleware/          
│       └── auth.js          # JWT middleware
│
├── client/                   # Frontend React
│   ├── src/
│   │   ├── App.tsx          # Componente principal
│   │   ├── contexts/        
│   │   │   ├── AuthContext.tsx    # Contexto de autenticación
│   │   │   └── SocketContext.tsx  # Contexto WebSocket
│   │   ├── components/      
│   │   │   ├── Layout.tsx         # Layout principal
│   │   │   └── PrivateRoute.tsx   # Rutas protegidas
│   │   └── pages/           
│   │       ├── Dashboard.tsx      # Dashboard principal
│   │       ├── Login.tsx          # Página de login
│   │       ├── Register.tsx       # Página de registro
│   │       ├── Transactions.tsx   # Gestión de transacciones
│   │       ├── Budgets.tsx        # Gestión de presupuestos
│   │       ├── Categories.tsx     # Gestión de categorías
│   │       ├── Analytics.tsx      # Análisis financiero
│   │       └── Settings.tsx       # Configuración de usuario
│   └── package.json
│
├── data/                     # Base de datos SQLite (auto-generada)
│   └── finance_pro.db
└── package.json             # Dependencias del servidor
```

## 🚀 Instalación y Configuración

### Prerrequisitos
- Node.js 16+ instalado
- NPM o Yarn

### Instalación Rápida

1. **Clonar o descargar el proyecto**
```bash
cd financial_app
```

2. **Instalar dependencias del backend**
```bash
npm install
```

3. **Instalar dependencias del frontend**
```bash
cd client
npm install
cd ..
```

4. **Iniciar la aplicación**
```bash
# Opción 1: Iniciar backend y frontend por separado

# Terminal 1 - Backend (puerto 5000)
npm run server

# Terminal 2 - Frontend (puerto 3000)
cd client
npm start

# Opción 2: Iniciar ambos con un comando (requiere concurrently)
npm run dev
```

5. **Acceder a la aplicación**
```
http://localhost:3000
```

## 📱 Acceso desde Dispositivos Móviles

1. **Encontrar tu IP local**:
```bash
# Windows
ipconfig

# Mac/Linux
ifconfig
```

2. **Acceder desde tu móvil** (mismo WiFi):
```
http://[TU-IP-LOCAL]:3000
```

## 👤 Credenciales de Prueba

**Usuario Demo:**
- Usuario: `demo`
- Contraseña: `demo123`

## 🔥 Características Destacadas

### 1. **Dashboard Interactivo**
- Resumen de ingresos/gastos/balance
- Gráficos en tiempo real
- Transacciones recientes
- Alertas de presupuesto
- Comparación con mes anterior

### 2. **Sistema de Notificaciones**
- Alertas cuando gastas >80% del presupuesto
- Notificaciones de metas alcanzadas
- Recordatorios personalizables
- Badge de notificaciones no leídas

### 3. **Gestión Avanzada de Transacciones**
- Filtros por fecha, categoría, persona
- Búsqueda en tiempo real
- Edición inline
- Eliminación masiva
- Exportación de datos

### 4. **Presupuestos Inteligentes**
- Configuración por categoría
- Períodos flexibles (diario, semanal, mensual, anual)
- Alertas configurables
- Visualización de progreso

### 5. **Análisis y Reportes**
- Tendencias de 12 meses
- Distribución de gastos
- Comparativas mensuales
- Proyecciones futuras

### 6. **Seguridad**
- Autenticación JWT
- Contraseñas encriptadas con bcrypt
- Rate limiting
- Validación de datos
- Headers de seguridad con Helmet

## 🎨 Personalización

### Temas y Colores
Edita `client/src/App.tsx` para cambiar el tema:

```typescript
const theme = createTheme({
  palette: {
    primary: {
      main: '#4A90E2', // Tu color primario
    },
    // ... más colores
  }
});
```

### Categorías Predefinidas
Las categorías se crean automáticamente en `server/database/db.js`

### Moneda
Por defecto usa PEN (Soles). Puedes cambiar en la configuración de usuario.

## 📊 Base de Datos

### Tablas Principales
- **users**: Usuarios del sistema
- **categories**: Categorías de ingresos/gastos
- **transactions**: Todas las transacciones
- **budgets**: Presupuestos configurados
- **goals**: Metas de ahorro
- **notifications**: Sistema de notificaciones

### Índices Optimizados
- Búsquedas rápidas por fecha
- Queries optimizadas por usuario
- Índices en foreign keys

## 🔄 Actualizaciones en Tiempo Real

La aplicación usa WebSockets para:
- Sincronización instantánea entre pestañas
- Notificaciones push
- Actualizaciones de dashboard
- Alertas de presupuesto
- Estado de conexión

## 🚦 API Endpoints

### Autenticación
- `POST /api/auth/register` - Registro de usuario
- `POST /api/auth/login` - Inicio de sesión
- `GET /api/auth/me` - Usuario actual
- `PUT /api/auth/profile` - Actualizar perfil

### Transacciones
- `GET /api/transactions` - Listar con filtros
- `POST /api/transactions` - Crear transacción
- `PUT /api/transactions/:id` - Actualizar
- `DELETE /api/transactions/:id` - Eliminar
- `POST /api/transactions/bulk-delete` - Eliminar múltiples

### Dashboard
- `GET /api/dashboard/summary` - Resumen completo
- `GET /api/dashboard/analytics` - Datos analíticos

### Presupuestos
- `GET /api/budgets` - Listar presupuestos
- `POST /api/budgets` - Crear/actualizar presupuesto
- `DELETE /api/budgets/:id` - Eliminar
- `PATCH /api/budgets/:id/toggle` - Activar/desactivar

## 🔧 Desarrollo

### Variables de Entorno
Crea un archivo `.env` en la raíz:

```env
PORT=5000
JWT_SECRET=tu-clave-secreta-super-segura
NODE_ENV=development
CLIENT_URL=http://localhost:3000
```

### Scripts Disponibles

**Backend:**
- `npm start` - Iniciar servidor
- `npm run dev` - Servidor con hot reload

**Frontend:**
- `npm start` - Servidor de desarrollo
- `npm run build` - Build de producción
- `npm test` - Ejecutar tests

## 📈 Mejoras Futuras

- [ ] Exportación a Excel/PDF
- [ ] Modo oscuro
- [ ] Aplicación móvil nativa
- [ ] Integración bancaria
- [ ] Reconocimiento de recibos (OCR)
- [ ] Predicciones con IA
- [ ] Compartir presupuestos familiares
- [ ] Criptomonedas

## 🤝 Soporte

Si encuentras algún problema o tienes sugerencias:
1. Revisa la consola del navegador (F12)
2. Verifica los logs del servidor
3. Asegúrate de que ambos servidores estén corriendo

## 📝 Licencia

Este proyecto es para uso personal y educativo.

---

**Desarrollado con ❤️ para una mejor gestión financiera personal**
