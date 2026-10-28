const app = require('./src/app');
const config = require('./src/config');

app.listen(config.puerto, () => {
  console.log(`CR ora por ti escuchando en ${config.appUrl} (correo: ${config.mail.proveedor})`);
});
