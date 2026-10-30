const app = require('./src/app');
const config = require('./src/config');

app.listen(config.puerto, () => {
  console.log(`CR Juntos en la prueba escuchando en ${config.appUrl} (correo: ${config.mail.proveedor})`);
});
