import os
from flask import Flask, request, render_template, redirect, url_for, session, flash, jsonify
from flask_bcrypt import Bcrypt
from pymongo import MongoClient
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail
from itsdangerous import URLSafeTimedSerializer as Serializer
from functools import wraps
from bson import ObjectId
import json

app = Flask(__name__)
bcrypt = Bcrypt(app)

app.secret_key = os.getenv("SECRET_KEY", "una-clave-por-defecto")

client = MongoClient(os.getenv("MONGO_URI"))
db = client['base_de_datos_login'] 
collection = db['usuarios']
productos_collection = db['productos']  # Colección para productos
carritos_collection = db['carritos']    # Nueva colección para carritos

SENDGRID_API_KEY = os.getenv("SENDGRID_KEY") 

serializer = Serializer(app.secret_key, salt='password-reset-salt')

def enviar_email(destinatario, asunto, cuerpo):
    mensaje = Mail(
        from_email='cinenext758@gmail.com',
        to_emails=destinatario,
        subject=asunto,
        html_content=cuerpo
    )
    try:
        sg = SendGridAPIClient(SENDGRID_API_KEY) 
        response = sg.send(mensaje)
        print(f"Correo enviado con éxito! Status code: {response.status_code}")
    except Exception as e:
        print(f"Error al enviar el correo: {e}")

def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'usuario' not in session or session.get('role') != 'admin':
            flash("Acceso denegado: Se requieren permisos de administrador.")
            return redirect(url_for('pagina_principal'))
        return f(*args, **kwargs)
    return decorated_function

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'usuario' not in session:
            flash("Debes iniciar sesión para acceder a esta página.")
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function

@app.route('/')
def home():
    if 'usuario' not in session:
        return redirect(url_for('login'))
    return redirect(url_for('pagina_principal'))

@app.route('/register', methods=['GET', 'POST'])
def registro():
    if request.method == 'POST':
        usuario = request.form['usuario']
        email = request.form['email']
        contrasena = request.form['contrasena']

        if collection.find_one({'email': email}):
            flash("El correo electrónico ya está registrado.")
            return redirect(url_for('registro'))

        hashed_password = bcrypt.generate_password_hash(contrasena).decode('utf-8')

        collection.insert_one({
            'usuario': usuario,
            'email': email,
            'contrasena': hashed_password
        })
        
        session['usuario'] = usuario
        return redirect(url_for('pagina_principal'))

    return render_template('register.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        usuario = request.form['usuario']
        contrasena = request.form['contrasena']

        user = collection.find_one({'usuario': usuario})
        
        if user and bcrypt.check_password_hash(user['contrasena'], contrasena):
            session['usuario'] = usuario
            session['role'] = user.get('role', 'cliente') 
            return redirect(url_for('pagina_principal'))
        else:
            flash("Usuario o contraseña incorrectos.")
            return render_template('login.html')

    return render_template('login.html')

@app.route('/pagina_principal')
def pagina_principal():
    if 'usuario' not in session:
        return redirect(url_for('login'))
    return render_template('index.html', usuario=session['usuario'])

@app.route('/mi_perfil')
def mi_perfil():
    if 'usuario' not in session:
        return redirect(url_for('login'))
    
    usuario = session['usuario']
    user_data = collection.find_one({'usuario': usuario})
    return render_template('mi_perfil.html', usuario=user_data['usuario'], email=user_data['email'])

# ==================== RUTAS DE PRODUCTOS ====================

@app.route('/tienda')
@login_required
def tienda():
    """Página principal de la tienda - todos los usuarios pueden verla"""
    return render_template('tienda.html', usuario=session['usuario'])

@app.route('/admin/productos')
@admin_required
def admin_productos():
    """Panel de administración de productos - solo admin"""
    return render_template('admin_productos.html', usuario=session['usuario'])

# API para obtener todos los productos
@app.route('/api/productos', methods=['GET'])
@login_required
def obtener_productos():
    categoria = request.args.get('categoria', None)
    
    if categoria and categoria != 'todos':
        productos = list(productos_collection.find({'categoria': categoria}))
    else:
        productos = list(productos_collection.find())
    
    # Convertir ObjectId a string para JSON
    for producto in productos:
        producto['_id'] = str(producto['_id'])
    
    return jsonify(productos)

# API para buscar productos por código o nombre
@app.route('/api/productos/buscar', methods=['GET'])
@login_required
def buscar_productos():
    termino = request.args.get('q', '').strip()
    
    if not termino:
        return jsonify([])
    
    # Búsqueda por código o nombre (insensible a mayúsculas)
    productos = list(productos_collection.find({
        '$or': [
            {'codigo': {'$regex': termino, '$options': 'i'}},
            {'nombre': {'$regex': termino, '$options': 'i'}}
        ]
    }))
    
    for producto in productos:
        producto['_id'] = str(producto['_id'])
    
    return jsonify(productos)

# API para obtener un producto por ID
@app.route('/api/productos/<producto_id>', methods=['GET'])
@login_required
def obtener_producto(producto_id):
    try:
        producto = productos_collection.find_one({'_id': ObjectId(producto_id)})
        if producto:
            producto['_id'] = str(producto['_id'])
            return jsonify(producto)
        return jsonify({'error': 'Producto no encontrado'}), 404
    except:
        return jsonify({'error': 'ID inválido'}), 400

# API para crear producto (solo admin)
@app.route('/api/productos', methods=['POST'])
@admin_required
def crear_producto():
    data = request.get_json()
    
    # Validar datos requeridos
    if not all(k in data for k in ['nombre', 'precio', 'descripcion', 'codigo', 'categoria']):
        return jsonify({'error': 'Faltan campos requeridos'}), 400
    
    # Verificar que el código no exista
    if productos_collection.find_one({'codigo': data['codigo']}):
        return jsonify({'error': 'El código ya existe'}), 400
    
    nuevo_producto = {
        'nombre': data['nombre'],
        'precio': float(data['precio']),
        'descripcion': data['descripcion'],
        'codigo': data['codigo'],
        'categoria': data['categoria'],
        'imagen': data.get('imagen', './img/default.jpg'),
        'stock': data.get('stock', 0)
    }
    
    resultado = productos_collection.insert_one(nuevo_producto)
    nuevo_producto['_id'] = str(resultado.inserted_id)
    
    return jsonify(nuevo_producto), 201

# API para actualizar producto (solo admin)
@app.route('/api/productos/<producto_id>', methods=['PUT'])
@admin_required
def actualizar_producto(producto_id):
    try:
        data = request.get_json()
        
        # Verificar que el producto existe
        producto_existente = productos_collection.find_one({'_id': ObjectId(producto_id)})
        if not producto_existente:
            return jsonify({'error': 'Producto no encontrado'}), 404
        
        # Si se cambia el código, verificar que no exista otro producto con ese código
        if 'codigo' in data and data['codigo'] != producto_existente['codigo']:
            if productos_collection.find_one({'codigo': data['codigo']}):
                return jsonify({'error': 'El código ya existe'}), 400
        
        # Actualizar producto
        datos_actualizados = {}
        campos_permitidos = ['nombre', 'precio', 'descripcion', 'codigo', 'categoria', 'imagen', 'stock']
        
        for campo in campos_permitidos:
            if campo in data:
                if campo == 'precio':
                    datos_actualizados[campo] = float(data[campo])
                elif campo == 'stock':
                    datos_actualizados[campo] = int(data[campo])
                else:
                    datos_actualizados[campo] = data[campo]
        
        productos_collection.update_one(
            {'_id': ObjectId(producto_id)},
            {'$set': datos_actualizados}
        )
        
        producto_actualizado = productos_collection.find_one({'_id': ObjectId(producto_id)})
        producto_actualizado['_id'] = str(producto_actualizado['_id'])
        
        return jsonify(producto_actualizado)
    except Exception as e:
        return jsonify({'error': str(e)}), 400

# API para eliminar producto (solo admin)
@app.route('/api/productos/<producto_id>', methods=['DELETE'])
@admin_required
def eliminar_producto(producto_id):
    try:
        resultado = productos_collection.delete_one({'_id': ObjectId(producto_id)})
        
        if resultado.deleted_count == 0:
            return jsonify({'error': 'Producto no encontrado'}), 404
        
        return jsonify({'mensaje': 'Producto eliminado exitosamente'})
    except:
        return jsonify({'error': 'ID inválido'}), 400

# ==================== FIN RUTAS DE PRODUCTOS ====================

@app.route('/recuperar_contrasena', methods=['GET', 'POST'])
def recuperar_contrasena():
    if request.method == 'POST':
        email = request.form['email']
        usuario = collection.find_one({'email': email})

        if usuario:
            token = serializer.dumps(email, salt='password-reset-salt')
            enlace = url_for('restablecer_contrasena', token=token, _external=True)
            asunto = "Recuperación de contraseña"
            cuerpo = f"""
            <p>Hola, hemos recibido una solicitud para restablecer tu contraseña.</p>
            <p>Si no has solicitado este cambio, ignora este mensaje.</p>
            <p>Para restablecer tu contraseña, haz clic en el siguiente enlace:</p>
            <a href="{enlace}">Restablecer contraseña</a>
            """
            enviar_email(email, asunto, cuerpo)
            flash("Te hemos enviado un correo para recuperar tu contraseña.", "success")
        else:
            flash("El correo electrónico no está registrado.", "error")

    return render_template('recuperar_contrasena.html')

@app.route('/restablecer_contrasena/<token>', methods=['GET', 'POST'])
def restablecer_contrasena(token):
    try:
        email = serializer.loads(token, salt='password-reset-salt', max_age=3600)
    except:
        flash("El enlace de restablecimiento ha caducado o es inválido.", "error")
        return redirect(url_for('recuperar_contrasena'))

    if request.method == 'POST':
        nueva_contrasena = request.form['nueva_contrasena']
        hashed_password = bcrypt.generate_password_hash(nueva_contrasena).decode('utf-8')
        collection.update_one({'email': email}, {'$set': {'contrasena': hashed_password}})
        flash("Tu contraseña ha sido restablecida con éxito.", "success")
        return redirect(url_for('login'))

    return render_template('restablecer_contrasena.html')

@app.route('/admin')
@admin_required
def zona_admin():
    todos_los_usuarios = list(collection.find())
    return render_template('zona_admin.html', usuarios=todos_los_usuarios)

# ==================== RUTAS DE CARRITO DE COMPRAS ====================

@app.route('/carrito')
@login_required
def ver_carrito():
    """Página del carrito de compras"""
    return render_template('carrito.html', usuario=session['usuario'])

@app.route('/api/carrito', methods=['GET'])
@login_required
def obtener_carrito():
    """Obtener el carrito del usuario actual"""
    usuario = session['usuario']
    
    # Buscar o crear carrito del usuario
    carrito = carritos_collection.find_one({'usuario': usuario})
    
    if not carrito:
        return jsonify({'items': [], 'total': 0})
    
    # Obtener información completa de cada producto
    items_completos = []
    total = 0
    
    for item in carrito.get('items', []):
        producto = productos_collection.find_one({'_id': ObjectId(item['producto_id'])})
        if producto:
            # Verificar stock disponible
            stock_disponible = producto.get('stock', 0)
            cantidad_en_carrito = item['cantidad']
            
            # Ajustar cantidad si excede el stock
            if cantidad_en_carrito > stock_disponible:
                cantidad_en_carrito = stock_disponible
                # Actualizar en la base de datos
                carritos_collection.update_one(
                    {'usuario': usuario, 'items.producto_id': item['producto_id']},
                    {'$set': {'items.$.cantidad': stock_disponible}}
                )
            
            subtotal = producto['precio'] * cantidad_en_carrito
            total += subtotal
            
            items_completos.append({
                '_id': str(producto['_id']),
                'nombre': producto['nombre'],
                'codigo': producto['codigo'],
                'precio': producto['precio'],
                'imagen': producto.get('imagen', ''),
                'cantidad': cantidad_en_carrito,
                'stock_disponible': stock_disponible,
                'subtotal': subtotal
            })
    
    return jsonify({
        'items': items_completos,
        'total': round(total, 2)
    })

@app.route('/api/carrito/agregar', methods=['POST'])
@login_required
def agregar_al_carrito():
    """Agregar un producto al carrito"""
    data = request.get_json()
    producto_id = data.get('producto_id')
    cantidad = int(data.get('cantidad', 1))
    
    if not producto_id:
        return jsonify({'error': 'Producto no especificado'}), 400
    
    # Verificar que el producto existe y tiene stock
    producto = productos_collection.find_one({'_id': ObjectId(producto_id)})
    if not producto:
        return jsonify({'error': 'Producto no encontrado'}), 404
    
    stock_disponible = producto.get('stock', 0)
    if stock_disponible == 0:
        return jsonify({'error': 'Producto sin stock'}), 400
    
    usuario = session['usuario']
    
    # Buscar carrito del usuario
    carrito = carritos_collection.find_one({'usuario': usuario})
    
    if not carrito:
        # Crear nuevo carrito
        carritos_collection.insert_one({
            'usuario': usuario,
            'items': [{
                'producto_id': producto_id,
                'cantidad': min(cantidad, stock_disponible)
            }]
        })
    else:
        # Verificar si el producto ya está en el carrito
        item_existente = None
        for item in carrito.get('items', []):
            if item['producto_id'] == producto_id:
                item_existente = item
                break
        
        if item_existente:
            # Actualizar cantidad (sin exceder el stock)
            nueva_cantidad = min(item_existente['cantidad'] + cantidad, stock_disponible)
            carritos_collection.update_one(
                {'usuario': usuario, 'items.producto_id': producto_id},
                {'$set': {'items.$.cantidad': nueva_cantidad}}
            )
        else:
            # Agregar nuevo producto al carrito
            carritos_collection.update_one(
                {'usuario': usuario},
                {'$push': {'items': {
                    'producto_id': producto_id,
                    'cantidad': min(cantidad, stock_disponible)
                }}}
            )
    
    return jsonify({'mensaje': 'Producto agregado al carrito'})

@app.route('/api/carrito/actualizar', methods=['PUT'])
@login_required
def actualizar_cantidad_carrito():
    """Actualizar la cantidad de un producto en el carrito"""
    data = request.get_json()
    producto_id = data.get('producto_id')
    cantidad = int(data.get('cantidad', 1))
    
    if cantidad < 1:
        return jsonify({'error': 'Cantidad inválida'}), 400
    
    # Verificar stock disponible
    producto = productos_collection.find_one({'_id': ObjectId(producto_id)})
    if not producto:
        return jsonify({'error': 'Producto no encontrado'}), 404
    
    stock_disponible = producto.get('stock', 0)
    if cantidad > stock_disponible:
        return jsonify({'error': f'Solo hay {stock_disponible} unidades disponibles'}), 400
    
    usuario = session['usuario']
    
    carritos_collection.update_one(
        {'usuario': usuario, 'items.producto_id': producto_id},
        {'$set': {'items.$.cantidad': cantidad}}
    )
    
    return jsonify({'mensaje': 'Cantidad actualizada'})

@app.route('/api/carrito/eliminar/<producto_id>', methods=['DELETE'])
@login_required
def eliminar_del_carrito(producto_id):
    """Eliminar un producto del carrito"""
    usuario = session['usuario']
    
    carritos_collection.update_one(
        {'usuario': usuario},
        {'$pull': {'items': {'producto_id': producto_id}}}
    )
    
    return jsonify({'mensaje': 'Producto eliminado del carrito'})

@app.route('/api/carrito/vaciar', methods=['DELETE'])
@login_required
def vaciar_carrito():
    """Vaciar todo el carrito"""
    usuario = session['usuario']
    
    carritos_collection.update_one(
        {'usuario': usuario},
        {'$set': {'items': []}}
    )
    
    return jsonify({'mensaje': 'Carrito vaciado'})

@app.route('/api/carrito/comprar', methods=['POST'])
@login_required
def procesar_compra():
    """Procesar la compra y actualizar stock"""
    usuario = session['usuario']
    
    # Obtener carrito
    carrito = carritos_collection.find_one({'usuario': usuario})
    
    if not carrito or not carrito.get('items'):
        return jsonify({'error': 'El carrito está vacío'}), 400
    
    # Verificar stock y procesar cada item
    items_comprados = []
    total_compra = 0
    errores = []
    
    for item in carrito['items']:
        producto = productos_collection.find_one({'_id': ObjectId(item['producto_id'])})
        
        if not producto:
            errores.append(f"Producto no encontrado")
            continue
        
        stock_actual = producto.get('stock', 0)
        cantidad_solicitada = item['cantidad']
        
        if stock_actual == 0:
            errores.append(f"{producto['nombre']}: Sin stock disponible")
            continue
        
        if cantidad_solicitada > stock_actual:
            errores.append(f"{producto['nombre']}: Solo quedan {stock_actual} unidades")
            continue
        
        # Actualizar stock
        nuevo_stock = stock_actual - cantidad_solicitada
        productos_collection.update_one(
            {'_id': ObjectId(item['producto_id'])},
            {'$set': {'stock': nuevo_stock}}
        )
        
        subtotal = producto['precio'] * cantidad_solicitada
        total_compra += subtotal
        
        items_comprados.append({
            'nombre': producto['nombre'],
            'cantidad': cantidad_solicitada,
            'precio': producto['precio'],
            'subtotal': subtotal
        })
    
    if not items_comprados:
        return jsonify({
            'error': 'No se pudo procesar ningún producto',
            'detalles': errores
        }), 400
    
    # Vaciar carrito después de compra exitosa
    carritos_collection.update_one(
        {'usuario': usuario},
        {'$set': {'items': []}}
    )
    
    # Retornar resumen de compra
    return jsonify({
        'mensaje': '¡Compra realizada con éxito!',
        'items': items_comprados,
        'total': round(total_compra, 2),
        'errores': errores if errores else None
    })

@app.route('/api/carrito/cantidad', methods=['GET'])
@login_required
def obtener_cantidad_carrito():
    """Obtener la cantidad total de items en el carrito"""
    usuario = session['usuario']
    carrito = carritos_collection.find_one({'usuario': usuario})
    
    if not carrito:
        return jsonify({'cantidad': 0})
    
    cantidad_total = sum(item['cantidad'] for item in carrito.get('items', []))
    return jsonify({'cantidad': cantidad_total})

# ==================== RUTAS ADMIN PARA STOCK ====================

@app.route('/api/admin/stock/<producto_id>', methods=['PUT'])
@admin_required
def actualizar_stock_admin(producto_id):
    """Actualizar el stock de un producto (solo admin)"""
    data = request.get_json()
    nuevo_stock = int(data.get('stock', 0))
    
    if nuevo_stock < 0:
        return jsonify({'error': 'El stock no puede ser negativo'}), 400
    
    productos_collection.update_one(
        {'_id': ObjectId(producto_id)},
        {'$set': {'stock': nuevo_stock}}
    )
    
    return jsonify({
        'mensaje': 'Stock actualizado correctamente',
        'nuevo_stock': nuevo_stock
    })

# ==================== FIN RUTAS DE CARRITO ====================

@app.route('/logout')
def logout():
    session.pop('usuario', None)
    session.pop('role', None)
    return redirect(url_for('login'))

if __name__ == '__main__':
    app.run(debug=True)
