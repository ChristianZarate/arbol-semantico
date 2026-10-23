# Motor de inferencia · Árbol semántico

Aplicación web que convierte reglas escritas en español a lógica proposicional y construye su **árbol semántico (tableau)** para decidir si las reglas pueden ser verdaderas al mismo tiempo.

**Demo en línea:** https://christianzarate.github.io/arbol-semantico/

Proyecto de la materia *7E262 · Sistemas Expertos* (CETI).

## Qué hace

1. **Lee reglas en lenguaje natural**, una por línea.
2. **Detecta los átomos** (proposiciones simples) y les asigna una letra: p, q, r… La misma frase, sin importar mayúsculas ni acentos, es el mismo átomo. "No voy a trabajar" es ¬q, no un átomo nuevo.
3. **Traduce los conectores** a fórmulas con paréntesis:

   | Español | Símbolo |
   |---|---|
   | no / no es cierto que / ni… ni | ¬ |
   | y / pero | ∧ |
   | o / o bien | ∨ |
   | si A, entonces B / B si A / A solo si B | → |
   | A si y solo si B | ↔ |

4. **Construye el árbol semántico** suponiendo que todas las reglas son verdaderas. Aplica las reglas de expansión:
   - Una sola rama (α): ∧, ¬∨, ¬→, ¬¬
   - Dos ramas (β): ∨, →, ↔, ¬∧, ¬↔
5. **Marca** con ✓ las fórmulas ya usadas y cierra con ✕ las ramas que contienen un átomo y su negación.
6. **Reporta las ramas abiertas** como valores de verdad (por ejemplo p = V, q = V, r = F). Si todas se cierran, indica que la base es inconsistente.

## Caso de prueba mínimo

~~~
Si es de día, entonces voy a trabajar.
Si llueve, entonces no voy a trabajar.
Es de día.
~~~

Átomos: p = es de día, q = voy a trabajar, r = llueve.
Fórmulas: R1 `p → q`, R2 `r → ¬q`, R3 `p`.
Resultado: **2 ramas cerradas ✕ y 1 abierta**, con el modelo **p = V, q = V, r = F**.

## Cómo está hecho

- `index.html`: interfaz (átomos, fórmulas, árbol visual, resultado).
- `motor.js`: parser de español a fórmulas y algoritmo de tableau. Sin dependencias.
- Todo corre en el navegador, sin servidor. Se publica con GitHub Pages.

El motor expande primero las fórmulas que no abren ramas (α) y después las que sí (β), lo que mantiene el árbol pequeño.

## Limitaciones

- Una regla por línea (o por oración terminada en punto).
- Sin paréntesis: **o** separa primero y luego **y**, así que "A y B o C" se lee como (A ∧ B) ∨ C.
- Evita sujetos compuestos ("Juan y Ana estudian"); escribe "Juan estudia y Ana estudia".
- Dos frases con distinta redacción ("llueve" y "está lloviendo") cuentan como átomos distintos.

## Uso local

Descarga el repo y abre `index.html` en el navegador.
# arbol-semantico
