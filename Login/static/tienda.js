// Variables globales
let todosLosProductos = [];
let categoriaActual = 'todos';

// Elementos del DOM
const contenedorProductos = document.getElementById('contenedor-productos');
const botonesCategorias = document.querySelectorAll('.boton-categoria');
const tituloPrincipal = document.getElementById('titulo-principal');
const searchInput = document.getElementById('search-input');
const searchBtn = document.getElementById('search-btn');
const loading = document.getElementById('loading');
const noResults = document.getElementById('no-results');

// Inicializar al cargar la página
document.addEventListener('DOMContentLoaded', () => {
    cargarProductos();
    configurarEventos();
});

// Configurar event listeners
function configurarEventos() {
    // Botones de categorías
    botonesCategorias.forEach(boton => {
        boton.addEventListener('click', (e) => {
            // Actualizar botón activo
            botonesCategorias.forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            
            // Cambiar categoría
            categoriaActual = e.currentTarget.id;
            
            // Actualizar título
            const nombresCategorias = {
                'todos': 'Todos los productos',
                'peliculas': 'Películas',
                'series': 'Series',
                'libros': 'Libros'
            };
            tituloPrincipal.textContent = nombresCategorias[categoriaActual];
            
            // Limpiar búsqueda y cargar productos
            searchInput.value = '';
            cargarProductos();
        });
    });

    // Búsqueda
    searchBtn.addEventListener('click', realizarBusqueda);
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            realizarBusqueda();
        }
    });
}

// Cargar productos del servidor
async function cargarProductos() {
    mostrarLoading(true);
    
    try {
        const url = categoriaActual === 'todos' 
            ? '/api/productos' 
            : `/api/productos?categoria=${categoriaActual}`;
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error('Error al cargar productos');
        }
        
        const productos = await response.json();
        todosLosProductos = productos;
        mostrarProductos(productos);
    } catch (error) {
        console.error('Error:', error);
        mostrarError('Error al cargar los productos. Por favor, intenta de nuevo.');
    } finally {
        mostrarLoading(false);
    }
}

// Realizar búsqueda
async function realizarBusqueda() {
    const termino = searchInput.value.trim();
    
    if (!termino) {
        cargarProductos();
        return;
    }
    
    mostrarLoading(true);
    
    try {
        const response = await fetch(`/api/productos/buscar?q=${encodeURIComponent(termino)}`);
        
        if (!response.ok) {
            throw new Error('Error en la búsqueda');
        }
        
        const productos = await response.json();
        tituloPrincipal.textContent = `Resultados de búsqueda: "${termino}"`;
        mostrarProductos(productos);
    } catch (error) {
        console.error('Error:', error);
        mostrarError('Error al buscar productos. Por favor, intenta de nuevo.');
    } finally {
        mostrarLoading(false);
    }
}

// Mostrar productos en la interfaz
function mostrarProductos(productos) {
    contenedorProductos.innerHTML = '';
    
    if (productos.length === 0) {
        noResults.style.display = 'block';
        return;
    }
    
    noResults.style.display = 'none';
    
    productos.forEach(producto => {
        const productoCard = crearTarjetaProducto(producto);
        contenedorProductos.appendChild(productoCard);
    });
}

// Crear tarjeta de producto
function crearTarjetaProducto(producto) {
    const div = document.createElement('div');
    div.className = 'producto-card';
    
    const categoriaNombre = {
        'peliculas': 'Películas',
        'series': 'Series',
        'libros': 'Libros'
    }[producto.categoria] || producto.categoria;
    
    div.innerHTML = `
        <div class="producto-imagen-container">
            <img src="${producto.imagen || '../static/img/default.jpg'}" 
                 alt="${producto.nombre}" 
                 class="producto-imagen"
                 onerror="this.src='../static/img/default.jpg'">
            <span class="producto-categoria-badge">${categoriaNombre}</span>
        </div>
        <div class="producto-info">
            <h3 class="producto-nombre">${producto.nombre}</h3>
            <p class="producto-codigo">Código: ${producto.codigo}</p>
            <p class="producto-descripcion">${truncarTexto(producto.descripcion, 100)}</p>
            <div class="producto-footer">
                <span class="producto-precio">$${formatearPrecio(producto.precio)}</span>
                ${producto.stock > 0 
                    ? `<span class="producto-stock disponible">
                        <i class="fas fa-check-circle"></i> Disponible (${producto.stock})
                       </span>` 
                    : `<span class="producto-stock agotado">
                        <i class="fas fa-times-circle"></i> Agotado
                       </span>`
                }
            </div>
            <button class="btn-ver-detalles" onclick="verDetalles('${producto._id}')">
                <i class="fas fa-eye"></i> Ver Detalles
            </button>
        </div>
    `;
    
    return div;
}

// Ver detalles de un producto
async function verDetalles(productoId) {
    try {
        const response = await fetch(`/api/productos/${productoId}`);
        
        if (!response.ok) {
            throw new Error('Error al obtener detalles');
        }
        
        const producto = await response.json();
        mostrarModalDetalles(producto);
    } catch (error) {
        console.error('Error:', error);
        mostrarError('Error al cargar los detalles del producto.');
    }
}

// Mostrar modal con detalles del producto
function mostrarModalDetalles(producto) {
    const categoriaNombre = {
        'peliculas': 'Películas',
        'series': 'Series',
        'libros': 'Libros'
    }[producto.categoria] || producto.categoria;
    
    const modal = document.createElement('div');
    modal.className = 'modal-detalles';
    modal.innerHTML = `
        <div class="modal-contenido">
            <button class="modal-close" onclick="this.parentElement.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
            <div class="modal-body">
                <div class="modal-imagen">
                    <img src="${producto.imagen || '../static/img/default.jpg'}" 
                         alt="${producto.nombre}"
                         onerror="this.src='../static/img/default.jpg'">
                </div>
                <div class="modal-info">
                    <span class="modal-categoria">${categoriaNombre}</span>
                    <h2>${producto.nombre}</h2>
                    <p class="modal-codigo">Código: <strong>${producto.codigo}</strong></p>
                    <p class="modal-descripcion">${producto.descripcion}</p>
                    <div class="modal-precio-container">
                        <span class="modal-precio">$${formatearPrecio(producto.precio)}</span>
                        ${producto.stock > 0 
                            ? `<span class="modal-stock disponible">
                                <i class="fas fa-check-circle"></i> ${producto.stock} disponibles
                               </span>` 
                            : `<span class="modal-stock agotado">
                                <i class="fas fa-times-circle"></i> Sin stock
                               </span>`
                        }
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Cerrar al hacer clic fuera del modal
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

// Utilidades
function mostrarLoading(mostrar) {
    loading.style.display = mostrar ? 'block' : 'none';
    contenedorProductos.style.display = mostrar ? 'none' : 'grid';
}

function formatearPrecio(precio) {
    return parseFloat(precio).toFixed(2);
}

function truncarTexto(texto, maxLength) {
    if (texto.length <= maxLength) return texto;
    return texto.substring(0, maxLength) + '...';
}

function mostrarError(mensaje) {
    const toast = document.createElement('div');
    toast.className = 'toast toast-error';
    toast.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${mensaje}`;
    document.body.appendChild(toast);
    
    setTimeout(() => toast.classList.add('show'), 100);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
