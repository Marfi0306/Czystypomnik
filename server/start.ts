import app from './index';
app.listen(Number(process.env.PORT||3001),process.env.HOST||'127.0.0.1',()=>console.log(`Czysty Pomnik API: http://127.0.0.1:${process.env.PORT||3001}`));
