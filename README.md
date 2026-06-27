# Sistema007

Sistema007 es una aplicación web orientada a la gestión farmacéutica. Su objetivo es optimizar los procesos de control de inventario, dispensación de medicamentos y seguimiento de pacientes, proporcionando una solución organizada, segura y eficiente para el personal farmacéutico.

---

## Problema que resuelve

En los procesos farmacéuticos aún existen actividades manuales que pueden generar:

- Errores en la dispensación de medicamentos.
- Falta de trazabilidad.
- Dificultad para controlar el inventario.
- Riesgo de vencimiento de medicamentos.
- Demoras en la atención de pacientes.

Sistema007 busca centralizar la información y automatizar estos procesos para mejorar la eficiencia y la seguridad.

---

## Objetivo

Desarrollar una plataforma web que permita administrar los procesos farmacéuticos relacionados con:

- Gestión de usuarios.
- Control de inventario.
- Dispensación de medicamentos.
- Seguimiento de pacientes.
- Reportes y trazabilidad.

---

## Usuarios del sistema

- Regente de Farmacia
- Químico Farmacéutico
- Auxiliar de Farmacia
- Administrador del sistema

---

## Tecnologías utilizadas

- HTML5
- CSS3
- JavaScript
- Docker
- Docker Compose
- Nginx
- Git
- GitHub
- GitHub Actions

---

## Estructura del proyecto

```text
Sistema007/
│
├── css/
│   └── style.css
│
├── img/
│   ├── Logo.jpg
│   └── image.jpg
│
├── index.html
├── login.html
├── Dockerfile
├── docker-compose.yml
├── README.md
│
└── .github/
    └── workflows/
        └── validar.yml
```

## Implementación con Docker

El proyecto fue contenerizado utilizando Docker y Nginx como servidor web.

Docker permite ejecutar Sistema007 dentro de un contenedor independiente del sistema operativo, facilitando el despliegue, la portabilidad y la configuración del entorno.

Para iniciar la aplicación se utiliza Docker Compose.

Construcción y ejecución:

docker compose up -d --build

Detener los servicios:

docker compose down

## Acceso al proyecto

Una vez iniciado el contenedor, la aplicación estará disponible en:

http://localhost:8080

## Comandos de verificación

Ver contenedores:

docker ps

Ver imágenes:

docker images

Ver redes:

docker network ls

Ver volúmenes:

docker volume ls

## Integración DevOps

Sistema007 implementa principios básicos de DevOps mediante:

Contenerización con Docker.
Orquestación utilizando Docker Compose.
Control de versiones con Git.
Repositorio remoto en GitHub.
Automatización de validaciones mediante GitHub Actions.

Estas herramientas permiten facilitar el desarrollo colaborativo y garantizar que el proyecto pueda ejecutarse de manera consistente en diferentes equipos.

## Demo

GitHub Pages:

https://denngoep.github.io/Sistema007/

Repositorio GitHub:

https://github.com/denngoep/Sistema007

## Vista del proyecto

[Sistema007](img/captura.png)

## Autor

Dennis González

Tecnólogo en Análisis y Desarrollo de Software

SENA – Centro de Tecnología y Manufactura Avanzada

Proyecto académico Sistema007 – Gestión farmacéutica inteligente.
