// Variables globales
let carritoActual = { items: [], total: 0 };

// Elementos del DOM
const loadingCarrito = document.getElementById('loading-carrito');
const carritoVacio = document.getElementById('carrito-vacio');
const itemsContainer = document.getElementById('items-container');
const resumenContainer = document.getElementById('resumen-container');
const resumenSubtotal = document.getElementById('resumen-subtotal');
const resumenTotal = document.getElementById('resumen-total');
const btnVaciarCarrito = document.getElementById('btn-vaciar-carrito');
const btnComprar = document.getElementById('btn-comprar');
const cartBadgeNav = document.getElementById('cart-badge-nav');

// Modales
const modalCompra = document.getElementById('modal-compra');
const modalCompraBody = document.getElementById('modal-compra-body');
const modalVaciar = document.getElementById('modal-vaciar');
const confirmarVaciar = document.getElementById('confirmar-vaciar');
const cancelarVaciar = document.getElementById('cancelar-vaciar');

// Inicializar
document.addEventListener('DOMContentLoaded', () => {
    cargarCarrito();
    configurarEventos();
    actualizarBadgeCarrito();
});

// Configurar event listeners
function configurarEventos() {
    btnVaciarCarrito.addEventListener('click', abrirModalVaciar);
    btnComprar.addEventListener('click', procesarCompra);
    confirmarVaciar.addEventListener('click', vaciarCarrito);
    cancelarVaciar.addEventListener('click', cerrarModalVaciar);
    
    // Cerrar modales al hacer click fuera
    modalVaciar.addEventListener('click', (e) => {
        if (e.target === modalVaciar) cerrarModalVaciar();
    });
    
    modalCompra.addEventListener('click', (e) => {
        if (e.target === modalCompra) cerrarModalCompra();
    });
}

// Cargar carrito del servidor
async function cargarCarrito() {
    mostrarLoading(true);
    
    try {
        const response = await fetch('/api/carrito');
        
        if (!response.ok) {
            throw new Error('Error al cargar el carrito');
        }
        
        carritoActual = await response.json();
        mostrarCarrito();
    } catch (error) {
        console.error('Error:', error);
        mostrarToast('Error al cargar el carrito', 'error');
    } finally {
        mostrarLoading(false);
    }
}

// Mostrar carrito en la interfaz
function mostrarCarrito() {
    if (carritoActual.items.length === 0) {
        carritoVacio.style.display = 'flex';
        itemsContainer.style.display = 'none';
        resumenContainer.style.display = 'none';
        btnVaciarCarrito.style.display = 'none';
        return;
    }
    
    carritoVacio.style.display = 'none';
    itemsContainer.style.display = 'block';
    resumenContainer.style.display = 'block';
    btnVaciarCarrito.style.display = 'inline-flex';
    
    // Limpiar contenedor
    itemsContainer.innerHTML = '';
    
    // Crear cards de productos
    carritoActual.items.forEach(item => {
        const itemCard = crearItemCard(item);
        itemsContainer.appendChild(itemCard);
    });
    
    // Actualizar resumen
    actualizarResumen();
}

// Crear tarjeta de item del carrito
function crearItemCard(item) {
    const div = document.createElement('div');
    div.className = 'carrito-item';
    div.dataset.productoId = item._id;
    
    const stockBajo = item.stock_disponible < 5;
    const sinStock = item.stock_disponible === 0;
    
    div.innerHTML = `
        <div class="item-imagen">
            <img src="${item.imagen || '../static/img/default.jpg'}" 
                 alt="${item.nombre}"
                 onerror="this.src='../static/img/default.jpg'">
        </div>
        
        <div class="item-info">
            <h3>${item.nombre}</h3>
            <p class="item-codigo">Código: ${item.codigo}</p>
            <p class="item-precio">$${formatearPrecio(item.precio)} c/u</p>
            ${sinStock ? 
                '<p class="item-sin-stock"><i class="fas fa-exclamation-circle"></i> Sin stock</p>' : 
                stockBajo ? 
                `<p class="item-stock-bajo"><i class="fas fa-exclamation-triangle"></i> Quedan ${item.stock_disponible}</p>` : 
                `<p class="item-stock"><i class="fas fa-check-circle"></i> Stock: ${item.stock_disponible}</p>`
            }
        </div>
        
        <div class="item-cantidad">
            <label>Cantidad:</label>
            <div class="cantidad-control">
                <button class="btn-cantidad" onclick="cambiarCantidad('${item._id}', ${item.cantidad - 1})" 
                        ${item.cantidad <= 1 ? 'disabled' : ''}>
                    <i class="fas fa-minus"></i>
                </button>
                <input type="number" 
                        value="${item.cantidad}" 
                        min="1" 
                        max="${item.stock_disponible}"
                        onchange="actualizarCantidad('${item._id}', this.value)"
                        ${sinStock ? 'disabled' : ''}>
                <button class="btn-cantidad" onclick="cambiarCantidad('${item._id}', ${item.cantidad + 1})"
                        ${item.cantidad >= item.stock_disponible ? 'disabled' : ''}>
                    <i class="fas fa-plus"></i>
                </button>
            </div>
        </div>
        
        <div class="item-subtotal">
            <span class="label">Subtotal:</span>
            <span class="precio">$${formatearPrecio(item.subtotal)}</span>
        </div>
        
        <div class="item-acciones">
            <button class="btn-eliminar" onclick="eliminarItem('${item._id}')" title="Eliminar">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `;
    
    return div;
}

// Actualizar resumen de compra
function actualizarResumen() {
    resumenSubtotal.textContent = `$${formatearPrecio(carritoActual.total)}`;
    resumenTotal.textContent = `$${formatearPrecio(carritoActual.total)}`;
}

// Cambiar cantidad de un producto
async function cambiarCantidad(productoId, nuevaCantidad) {
    if (nuevaCantidad < 1) return;
    
    try {
        const response = await fetch('/api/carrito/actualizar', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                producto_id: productoId,
                cantidad: nuevaCantidad
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Error al actualizar');
        }
        
        await cargarCarrito();
        actualizarBadgeCarrito();
    } catch (error) {
        console.error('Error:', error);
        mostrarToast(error.message, 'error');
    }
}

// Actualizar cantidad desde input
async function actualizarCantidad(productoId, valor) {
    const cantidad = parseInt(valor);
    if (isNaN(cantidad) || cantidad < 1) {
        await cargarCarrito();
        return;
    }
    
    await cambiarCantidad(productoId, cantidad);
}

// Eliminar item del carrito
async function eliminarItem(productoId) {
    try {
        const response = await fetch(`/api/carrito/eliminar/${productoId}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            throw new Error('Error al eliminar producto');
        }
        
        mostrarToast('Producto eliminado del carrito', 'success');
        await cargarCarrito();
        actualizarBadgeCarrito();
    } catch (error) {
        console.error('Error:', error);
        mostrarToast('Error al eliminar producto', 'error');
    }
}

// Abrir modal para vaciar carrito
function abrirModalVaciar() {
    modalVaciar.style.display = 'flex';
}

// Cerrar modal de vaciar carrito
function cerrarModalVaciar() {
    modalVaciar.style.display = 'none';
}

// Vaciar carrito
async function vaciarCarrito() {
    try {
        const response = await fetch('/api/carrito/vaciar', {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            throw new Error('Error al vaciar carrito');
        }
        
        cerrarModalVaciar();
        mostrarToast('Carrito vaciado', 'success');
        await cargarCarrito();
        actualizarBadgeCarrito();
    } catch (error) {
        console.error('Error:', error);
        mostrarToast('Error al vaciar carrito', 'error');
    }
}

// Procesar compra
async function procesarCompra() {
    if (carritoActual.items.length === 0) {
        mostrarToast('El carrito está vacío', 'error');
        return;
    }
    
    // Deshabilitar botón mientras procesa
    btnComprar.disabled = true;
    btnComprar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando...';
    
    try {
        const response = await fetch('/api/carrito/comprar', {
            method: 'POST'
        });
        
        const resultado = await response.json();
        
        if (!response.ok) {
            throw new Error(resultado.error || 'Error al procesar la compra');
        }
        
        // Mostrar modal de compra exitosa
        mostrarModalCompraExitosa(resultado);
        
        // Recargar carrito
        await cargarCarrito();
        actualizarBadgeCarrito();
    } catch (error) {
        console.error('Error:', error);
        mostrarToast(error.message, 'error');
    } finally {
        btnComprar.disabled = false;
        btnComprar.innerHTML = '<i class="fas fa-credit-card"></i> Proceder con la Compra';
    }
}

// Mostrar modal de compra exitosa
function mostrarModalCompraExitosa(resultado) {
    let contenidoHTML = `
        <div class="compra-exitosa">
            <div class="compra-resumen">
                <h4>Resumen de tu Compra:</h4>
                <table class="tabla-compra">
                    <thead>
                        <tr>
                            <th>Producto</th>
                            <th>Cantidad</th>
                            <th>Precio</th>
                            <th>Subtotal</th>
                        </tr>
                    </thead>
                    <tbody>
    `;
    
    resultado.items.forEach(item => {
        contenidoHTML += `
            <tr>
                <td>${item.nombre}</td>
                <td>${item.cantidad}</td>
                <td>$${formatearPrecio(item.precio)}</td>
                <td>$${formatearPrecio(item.subtotal)}</td>
            </tr>
        `;
    });
    
    contenidoHTML += `
                    </tbody>
                </table>
                <div class="compra-total">
                    <strong>Total Pagado:</strong>
                    <strong class="total-precio">$${formatearPrecio(resultado.total)}</strong>
                </div>
            </div>
    `;
    
    // Mostrar errores si los hay (productos sin stock)
    if (resultado.errores && resultado.errores.length > 0) {
        contenidoHTML += `
            <div class="compra-advertencias">
                <h4><i class="fas fa-exclamation-triangle"></i> Advertencias:</h4>
                <ul>
        `;
        resultado.errores.forEach(error => {
            contenidoHTML += `<li>${error}</li>`;
        });
        contenidoHTML += `
                </ul>
            </div>
        `;
    }
    
    contenidoHTML += `
            <p class="compra-mensaje">Tu pedido ha sido procesado exitosamente. ¡Gracias por confiar en CineNext!</p>
        </div>
    `;
    
    modalCompraBody.innerHTML = contenidoHTML;
    modalCompra.style.display = 'flex';
}

// Cerrar modal de compra
function cerrarModalCompra() {
    modalCompra.style.display = 'none';
}

// Actualizar badge del carrito en el navbar
async function actualizarBadgeCarrito() {
    try {
        const response = await fetch('/api/carrito/cantidad');
        const data = await response.json();
        
        if (cartBadgeNav) {
            cartBadgeNav.textContent = data.cantidad;
            cartBadgeNav.style.display = data.cantidad > 0 ? 'inline-block' : 'none';
        }
    } catch (error) {
        console.error('Error al actualizar badge:', error);
    }
}

// Utilidades
function mostrarLoading(mostrar) {
    loadingCarrito.style.display = mostrar ? 'flex' : 'none';
}

function formatearPrecio(precio) {
    return parseFloat(precio).toFixed(2);
}

function mostrarToast(mensaje, tipo = 'info') {
    const toast = document.getElementById('toast');
    const iconos = {
        'success': 'fa-check-circle',
        'error': 'fa-exclamation-circle',
        'info': 'fa-info-circle'
    };
    
    toast.className = `toast toast-${tipo} show`;
    toast.innerHTML = `<i class="fas ${iconos[tipo]}"></i> ${mensaje}`;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}
