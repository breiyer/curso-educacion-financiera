# Vida crediticia desde cero

Curso interactivo y gratuito de educación financiera enfocado en crédito, para Colombia (COP). 14 módulos, 22 simuladores, cuestionarios, examen final, glosario y certificado.

Sitio estático sin dependencias: HTML, CSS y JavaScript. El progreso se guarda en `localStorage` del navegador.

## Estructura

- `index.html`, `glosario.html`, `examen.html`, `certificado.html`, `fuentes.html`
- `modulos/m01.html` … `m14.html`
- `js/finance.js`: matemática financiera (se prueba con Node)
- `js/sims.js`: simuladores · `js/quizzes.js`: preguntas · `js/app.js`: navegación y progreso
- `FUENTES.md`: fuentes y puntos por verificar

## Probar los cálculos

```
node tests/finance.test.js
```

## Aviso

Contenido educativo. No es asesoría financiera ni legal. Tasas y normas con fecha de corte 17 de noviembre de 2026.
