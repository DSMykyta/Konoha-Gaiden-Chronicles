import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const publicRoot=path.resolve(import.meta.dirname,'../public');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.woff2':'font/woff2','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif','.svg':'image/svg+xml','.mp4':'video/mp4'};

export function createLocalServer(){
 return http.createServer(async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{Allow:'GET, HEAD'});res.end();return;}
  try{
   const url=new URL(req.url,'http://localhost'),pathname=decodeURIComponent(url.pathname),file=path.resolve(publicRoot,'.'+(pathname==='/'?'/index.html':pathname));
   const relative=path.relative(publicRoot,file);
   if(relative.startsWith('..'+path.sep)||relative==='..'||path.isAbsolute(relative)){res.writeHead(403);res.end();return;}
   const content=await fs.readFile(file);
   res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Content-Length':content.length});
   res.end(req.method==='HEAD'?undefined:content);
  }catch(error){res.writeHead(error.code==='ENOENT'?404:400,{'Content-Type':'text/plain; charset=utf-8'});res.end('Файл не знайдено. Запусти сайт командою npm start у папці SITE.');}
 });
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 const index=process.argv.indexOf('--port'),port=Number(index>=0?process.argv[index+1]:process.env.PORT||4173);
 if(!Number.isInteger(port)||port<1||port>65535)throw new Error('Вкажи порт від 1 до 65535.');
 const server=createLocalServer();
 server.on('error',error=>{console.error(error.code==='EADDRINUSE'?`Порт ${port} зайнятий. Закрий попередній сервер або запусти npm start -- --port ${port+1}.`:error.message);process.exitCode=1;});
 server.listen(port,'127.0.0.1',()=>console.log(`Хронологія: http://localhost:${port}\nCtrl + C — зупинити сервер.`));
}
