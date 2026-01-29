// Variables globales
let productosActuales = [];
let productoEditando = null;

// Elementos del DOM
const formProducto = document.getElementById('form-producto');
const productoIdInput = document.getElementById('producto-id');
const nombreInput = document.getElementById('nombre');
const codigoInput = document.getElementById('codigo');
const precioInput = document.getElementById('precio');
const categoriaSelect = document.getElementById('categoria');
const stockInput = document.getElementById('stock');
const imagenInput = document.getElementById('imagen');
const descripcionTextarea = document.getElementById('descripcion');
const tbodyProductos = document.getElementById('tbody-productos');
const searchAdmin = document.getElementById('search-admin');
const btnCancelar = document.getElementById('btn-cancelar');
const btnSubmit = document.getElementById('btn-submit');
const btnText = document.getElementById('btn-text');
const formTitle = document.getElementById('form-title');
const loadingProductos = document.getElementById('loading-productos');
const noProductos = document.getElementById('no-productos');
const tablaContainer = document.getElementById('tabla-productos-container');

// Modal
const modal = document.getElementById('modal-confirmacion');
const modalProductoNombre = document.getElementById('modal-producto-nombre');
const btnConfirmarEliminar = document.getElementById('btn-confirmar-eliminar');
const btnCancelarModal = document.getElementById('btn-cancelar-modal');

// Inicializar
document.addEventListener('DOMContentLoaded', () => {
    cargarProductos();
    configurarEventos();
});

// Configurar eventos
function configurarEventos() {
    formProducto.addEventListener('submit', handleSubmit);
    btnCancelar.addEventListener('click', cancelarEdicion);
    searchAdmin.addEventListener('input', filtrarProductos);
    btnCancelarModal.addEventListener('click', cerrarModal);
    
    // Cerrar modal al hacer clic fuera
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            cerrarModal();
        }
    });
}

// Cargar productos
async function cargarProductos() {
    mostrarLoading(true);
    
    try {
        const response = await fetch('/api/productos');
        
        if (!response.ok) {
            throw new Error('Error al cargar productos');
        }
        
        productosActuales = await response.json();
        mostrarProductosEnTabla(productosActuales);
    } catch (error) {
        console.error('Error:', error);
        mostrarToast('Error al cargar productos', 'error');
    } finally {
        mostrarLoading(false);
    }
}

// Mostrar productos en la tabla
function mostrarProductosEnTabla(productos) {
    tbodyProductos.innerHTML = '';
    
    if (productos.length === 0) {
        noProductos.style.display = 'block';
        tablaContainer.style.display = 'none';
        return;
    }
    
    noProductos.style.display = 'none';
    tablaContainer.style.display = 'block';
    
    productos.forEach(producto => {
        const tr = crearFilaProducto(producto);
        tbodyProductos.appendChild(tr);
    });
}

// Crear fila de producto
function crearFilaProducto(producto) {
    const tr = document.createElement('tr');
    
    const categoriaNombre = {
        'peliculas': 'Películas',
        'series': 'Series',
        'libros': 'Libros'
    }[producto.categoria] || producto.categoria;
    
    tr.innerHTML = `
        <td><strong>${producto.codigo}</strong></td>
        <td>${producto.nombre}</td>
        <td>
            <span class="categoria-badge categoria-${producto.categoria}">
                ${categoriaNombre}
            </span>
        </td>
        <td>$${formatearPrecio(producto.precio)}</td>
        <td>
            ${producto.stock > 0 
                ? `<span class="stock-badge disponible">${producto.stock}</span>` 
                : `<span class="stock-badge agotado">0</span>`
            }
        </td>
        <td class="acciones">
            <button class="btn-accion btn-editar" onclick="editarProducto('${producto._id}')" title="Editar">
                <i class="fas fa-edit"></i>
            </button>
            <button class="btn-accion btn-eliminar" onclick="confirmarEliminar('${producto._id}', '${producto.nombre}')" title="Eliminar">
                <i class="fas fa-trash"></i>
            </button>
        </td>
    `;
    
    return tr;
}

// Manejar envío del formulario
async function handleSubmit(e) {
    e.preventDefault();
    
    const producto = {
        nombre: nombreInput.value.trim(),
        codigo: codigoInput.value.trim(),
        precio: parseFloat(precioInput.value),
        categoria: categoriaSelect.value,
        stock: parseInt(stockInput.value) || 0,
        imagen: imagenInput.value.trim() || './img/default.jpg',
        descripcion: descripcionTextarea.value.trim()
    };
    
    // Validaciones
    if (!validarProducto(producto)) {
        return;
    }
    
    try {
        if (productoEditando) {
            await actualizarProducto(productoEditando, producto);
        } else {
            await crearProducto(producto);
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

// Validar producto
function validarProducto(producto) {
    if (producto.precio <= 0) {
        mostrarToast('El precio debe ser mayor a 0', 'error');
        return false;
    }
    
    if (producto.codigo.length < 3) {
        mostrarToast('El código debe tener al menos 3 caracteres', 'error');
        return false;
    }
    
    if (producto.nombre.length < 3) {
        mostrarToast('El nombre debe tener al menos 3 caracteres', 'error');
        return false;
    }
    
    if (producto.descripcion.length < 10) {
        mostrarToast('La descripción debe tener al menos 10 caracteres', 'error');
        return false;
    }
    
    return true;
}

// Crear producto
async function crearProducto(producto) {
    try {
        const response = await fetch('/api/productos', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(producto)
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Error al crear producto');
        }
        
        mostrarToast('Producto creado exitosamente', 'success');
        limpiarFormulario();
        cargarProductos();
    } catch (error) {
        mostrarToast(error.message, 'error');
    }
}

// Editar producto
async function editarProducto(productoId) {
    try {
        const response = await fetch(`/api/productos/${productoId}`);
        
        if (!response.ok) {
            throw new Error('Error al cargar producto');
        }
        
        const producto = await response.json();
        
        // Llenar formulario
        productoIdInput.value = producto._id;
        nombreInput.value = producto.nombre;
        codigoInput.value = producto.codigo;
        precioInput.value = producto.precio;
        categoriaSelect.value = producto.categoria;
        stockInput.value = producto.stock || 0;
        imagenInput.value = producto.imagen || '';
        descripcionTextarea.value = producto.descripcion;
        
        // Cambiar modo a edición
        productoEditando = producto._id;
        formTitle.innerHTML = '<i class="fas fa-edit"></i> Editar Producto';
        btnText.textContent = 'Actualizar Producto';
        btnSubmit.classList.remove('btn-primary');
        btnSubmit.classList.add('btn-warning');
        btnCancelar.style.display = 'inline-block';
        
        // Scroll al formulario
        formProducto.scrollIntoView({ behavior: 'smooth' });
    } catch (error) {
        mostrarToast(error.message, 'error');
    }
}

// Actualizar producto
async function actualizarProducto(productoId, producto) {
    try {
        const response = await fetch(`/api/productos/${productoId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(producto)
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Error al actualizar producto');
        }
        
        mostrarToast('Producto actualizado exitosamente', 'success');
        limpiarFormulario();
        cancelarEdicion();
        cargarProductos();
    } catch (error) {
        mostrarToast(error.message, 'error');
    }
}

// Confirmar eliminación
function confirmarEliminar(productoId, nombreProducto) {
    productoEditando = productoId;
    modalProductoNombre.textContent = nombreProducto;
    modal.style.display = 'flex';
    
    btnConfirmarEliminar.onclick = () => eliminarProducto(productoId);
}

// Eliminar producto
async function eliminarProducto(productoId) {
    try {
        const response = await fetch(`/api/productos/${productoId}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Error al eliminar producto');
        }
        
        mostrarToast('Producto eliminado exitosamente', 'success');
        cerrarModal();
        cargarProductos();
    } catch (error) {
        mostrarToast(error.message, 'error');
        cerrarModal();
    }
}

// Cancelar edición
function cancelarEdicion() {
    productoEditando = null;
    limpiarFormulario();
    formTitle.innerHTML = '<i class="fas fa-plus-circle"></i> Crear Nuevo Producto';
    btnText.textContent = 'Crear Producto';
    btnSubmit.classList.remove('btn-warning');
    btnSubmit.classList.add('btn-primary');
    btnCancelar.style.display = 'none';
}

// Limpiar formulario
function limpiarFormulario() {
    formProducto.reset();
    productoIdInput.value = '';
}

// Filtrar productos
function filtrarProductos() {
    const termino = searchAdmin.value.toLowerCase().trim();
    
    if (!termino) {
        mostrarProductosEnTabla(productosActuales);
        return;
    }
    
    const productosFiltrados = productosActuales.filter(producto => 
        producto.nombre.toLowerCase().includes(termino) ||
        producto.codigo.toLowerCase().includes(termino) ||
        producto.categoria.toLowerCase().includes(termino)
    );
    
    mostrarProductosEnTabla(productosFiltrados);
}

// Cerrar modal
function cerrarModal() {
    modal.style.display = 'none';
    productoEditando = null;
}

// Mostrar/ocultar loading
function mostrarLoading(mostrar) {
    loadingProductos.style.display = mostrar ? 'block' : 'none';
}

// Formatear precio
function formatearPrecio(precio) {
    return parseFloat(precio).toFixed(2);
}

// Mostrar toast de notificación
function mostrarToast(mensaje, tipo = 'info') {
    const toast = document.getElementById('toast');
    const iconos = {
        'success': 'fa-check-circle',
        'error': 'fa-exclamation-circle',
        'info': 'fa-info-circle'
    };
    
    toast.className = `toast toast-${tipo}`;
    toast.innerHTML = `<i class="fas ${iconos[tipo]}"></i> ${mensaje}`;
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}
