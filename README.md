# jshop_admin

Static admin panel for `jshop_backend`.

## Features

- Dashboard counters.
- CRUD for lots.
- CRUD for categories.
- CRUD for contact channels.

## Run

Any static file server works. Example:

```bash
cd jshop_admin
node -e "require('http').createServer((req,res)=>{const fs=require('fs');const p=req.url==='/'?'index.html':req.url.slice(1);fs.readFile(p,(e,d)=>{if(e){res.statusCode=404;res.end('Not found');return;}res.end(d);});}).listen(8081)"
```

Then open `http://127.0.0.1:8081`.

By default, panel connects to `http://127.0.0.1:8000`.
