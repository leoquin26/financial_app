# 💰 Organizador Financiero Personal

Una aplicación web completa para organizar tus finanzas personales, con soporte móvil y funcionalidad offline.

## 🚀 Características

### 📊 Dashboard Completo
- Resumen de ingresos y gastos mensuales
- Balance en tiempo real
- Gráfico de gastos por categoría
- Gastos agrupados por persona
- Transacciones recientes

### 💳 Gestión de Transacciones
- Agregar ingresos y gastos
- Categorías predefinidas con iconos
- Descripción y persona asociada
- Marcar como recurrente
- Editar y eliminar transacciones

### 🎯 Presupuestos
- Configurar presupuesto por categoría
- Seguimiento visual del progreso
- Alertas cuando se excede el presupuesto

### 📱 Diseño Responsive
- Interfaz optimizada para móviles
- Progressive Web App (PWA)
- Funciona offline
- Instalable en dispositivos móviles

## 🛠️ Instalación

1. **Instalar dependencias:**
```bash
npm install
```

2. **Iniciar el servidor:**
```bash
npm start
```

3. **Acceder a la aplicación:**
```
http://localhost:3000
```

## 📲 Usar en el Móvil

### Opción 1: Acceso Web
1. Abre el navegador en tu móvil
2. Navega a `http://[TU-IP-LOCAL]:3000`
3. La app se adaptará automáticamente

### Opción 2: Instalar como App
1. Abre la app en Chrome/Safari móvil
2. Toca el menú (3 puntos en Android, compartir en iOS)
3. Selecciona "Agregar a pantalla de inicio"
4. La app funcionará como una aplicación nativa

## 🗂️ Estructura del Proyecto

```
financial_app/
├── package.json          # Dependencias del proyecto
├── server.js            # Servidor Express + API
├── data/               # Base de datos SQLite (se crea automáticamente)
│   └── finance.db
└── public/             # Frontend
    ├── index.html      # Página principal
    ├── styles.css      # Estilos
    ├── app.js         # Lógica de la aplicación
    ├── manifest.json  # Configuración PWA
    └── sw.js         # Service Worker para offline
```

## 📊 Categorías Predefinidas

### Gastos
- 🏠 Alquiler
- 🚗 Cochera
- 🚙 Carro
- 💳 Préstamo
- 💡 Servicios
- 🌴 Palma
- 💪 Gym
- 🍔 Comida
- 🧼 Higiene
- 🐕 Perros
- 👶 Guardería
- 🦷 Odontología

### Ingresos
- 💰 Salario
- 💵 Comisión
- 🏦 Ahorro
- 💸 Otros

## 🔧 Tecnologías Utilizadas

### Backend
- Node.js
- Express.js
- SQLite3
- CORS

### Frontend
- HTML5
- CSS3 (diseño moderno y responsive)
- JavaScript vanilla
- Chart.js para gráficos
- Progressive Web App (PWA)

## 💡 Características Especiales

1. **Base de datos local**: SQLite para almacenamiento persistente
2. **Sin necesidad de internet**: Funciona offline después de la primera carga
3. **Instalable**: Se puede instalar como app nativa en móviles
4. **Filtros avanzados**: Por tipo, persona, mes y año
5. **Visualización de datos**: Gráficos interactivos y coloridos
6. **Interfaz intuitiva**: Diseño moderno con iconos y colores

## 🎨 Personalización

Puedes personalizar los colores editando las variables CSS en `public/styles.css`:

```css
:root {
    --primary-color: #4A90E2;  /* Color principal */
    --secondary-color: #50C878; /* Color de ingresos */
    --danger-color: #FF6B6B;   /* Color de gastos */
}
```

## 📝 Notas de Desarrollo

- La base de datos se crea automáticamente al iniciar el servidor
- Las categorías se insertan automáticamente si no existen
- Los datos persisten entre sesiones
- El diseño es completamente responsive

## 🚀 Para Producción

Para usar en producción con acceso desde cualquier dispositivo:

1. **Configurar puerto y host:**
```javascript
// En server.js, cambiar:
const PORT = process.env.PORT || 3000;
// Y al final:
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
});
```

2. **Usar HTTPS** (recomendado para PWA):
- Configurar certificados SSL
- O usar servicios como ngrok para túnel HTTPS

## 📱 Soporte

La aplicación ha sido probada en:
- Chrome (Desktop y Mobile)
- Safari (iOS)
- Firefox
- Edge

## 🤝 Contribuir

Si encuentras algún bug o tienes sugerencias, siéntete libre de abrir un issue o enviar un pull request.
