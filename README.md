# Sistema007

Sistema007 es una aplicación web orientada a la gestión farmacéitica.
Su objetivo es apoyar procesos como el control de inventario, la dispensacióm de medicamentos y el seguimiento de pacientes.

## Problema que resuelve

En los procesos farmacéuticos pueden presentarse errores en registros manuales, falta de trazabilidad, dificultades en el control de inventario y demoras en la dispensación de medicamentos.

Sistema007 busca centralizar la información y facilitar una gestión más organizada, segura y eficiente.

## Tecnologías utilizadas

-HTML
-CSS
-JavaScript
-Docker
-Docker Compose
-Nginx
-Git
-Github Actions

## Estructura del proyecto

```text

SISTEMA007/
├── css/
│   └── style.css
├── img/
│   ├── image.jpg
│   └── Logo.jpg
├── index.html
├── login.html
├── Dockerfile
├── docker-compose.yml
└── README.md

Ejecución con Docker

Para ejecutar el proyecto con docker
docker compose up -d --build

Luego abrir en el navegador
http://localhost:8080

Verificación de contenedores
docker ps

Detener el proyecto
docker compose down

Implementación DevOps
El proyecto fue contenerizado con Docker usando Nginx como servidor web.
Docker Compose permite levantar el servicio de forma automática un solo comando.

Además, el repositorio puede integrarse con Github Actions para validar archivos importantes del proyecto en cada actualización.

Presentado por
Dennis Gonzalez
Tecnologia en Análisi y Desarrollo de Software.
SENA


```
