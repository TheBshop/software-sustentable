# CONTRATO DE SERVICIO DE RETIRO Y GESTIÓN DE RESIDUOS RECICLABLES

> Template base. Los campos `{{...}}` se completan desde los datos del cliente en el sistema.
> **Este modelo debe ser revisado por el asesor legal de la cooperativa antes de usarse.**

**Contrato N°** {{contrato.numero}}

En la ciudad de Paraná, provincia de Entre Ríos, a los {{fecha.dia}} días del mes de {{fecha.mes}} de {{fecha.anio}}, entre:

**COOPERATIVA DE TRABAJO NUEVA VIDA LTDA.**, CUIT {{coop.cuit}}, Matrícula INAES N° {{coop.matricula}}, con domicilio en {{coop.domicilio}}, representada por {{coop.representante}}, en adelante **"LA COOPERATIVA"**; y

**{{cliente.razonSocial}}**, CUIT {{cliente.cuit}}, con domicilio en {{cliente.direccion}}, representada por {{cliente.representante}}, en adelante **"EL GENERADOR"**,

acuerdan celebrar el presente contrato, sujeto a las siguientes cláusulas:

### PRIMERA — Objeto
LA COOPERATIVA prestará a EL GENERADOR el servicio de retiro, transporte, clasificación y gestión de residuos sólidos reciclables secos generados en {{cliente.direccionesRetiro}}, destinándolos a reciclado o reutilización.

### SEGUNDA — Materiales
Se incluyen los siguientes materiales: {{materiales.lista}}. Quedan excluidos residuos orgánicos, peligrosos, patogénicos y cualquier otro no listado. EL GENERADOR se compromete a entregar los materiales separados en origen y en condiciones de higiene razonables.

### TERCERA — Frecuencia
Los retiros se realizarán con frecuencia **{{contrato.frecuenciaRetiro}}**, en el horario de {{contrato.horario}}. Las partes podrán coordinar retiros adicionales.

### CUARTA — Registro y certificación
LA COOPERATIVA registrará cada retiro (fecha, materiales y pesos) y emitirá un **Certificado de Disposición Sustentable** digital con código QR verificable, que incluirá los kilogramos recuperados por material y una estimación del CO2 evitado según la metodología publicada por LA COOPERATIVA. Los certificados se enviarán a {{cliente.contacto.email}} y/o {{cliente.contacto.telefono}}.

### QUINTA — Precio y forma de pago
EL GENERADOR abonará por el servicio: **{{tarifa.descripcion}}** (modalidad: {{tarifa.modalidad}}).
LA COOPERATIVA emitirá la factura correspondiente con periodicidad {{facturacion.periodicidad}}, que deberá abonarse dentro de los **{{contrato.diasPagoFactura}} días corridos** desde su emisión, mediante transferencia a la cuenta {{coop.cbu}}.
Los precios podrán actualizarse {{actualizacion.periodicidad}} conforme a {{actualizacion.indice}}, con aviso previo de 30 días.

### SEXTA — Mora
La falta de pago en término facultará a LA COOPERATIVA a suspender el servicio previa intimación fehaciente de {{mora.diasIntimacion}} días, sin perjuicio del cobro de los intereses que correspondan.

### SÉPTIMA — Plazo
El presente contrato tendrá vigencia desde el {{contrato.inicio}} hasta el {{contrato.fin}}, renovándose automáticamente por períodos iguales salvo que alguna de las partes notifique su voluntad en contrario con 30 días de anticipación.

### OCTAVA — Rescisión
Cualquiera de las partes podrá rescindir el contrato sin expresión de causa notificando a la otra con 30 días de anticipación, sin derecho a indemnización, debiendo abonarse los servicios prestados hasta la fecha.

### NOVENA — Responsabilidades
LA COOPERATIVA es responsable por el personal que realiza los retiros y por el transporte desde el momento de la carga. EL GENERADOR garantiza el acceso seguro al lugar de retiro.

### DÉCIMA — Datos personales
Las partes tratarán los datos intercambiados conforme a la Ley 25.326 y exclusivamente para la ejecución de este contrato.

### UNDÉCIMA — Jurisdicción
Para cualquier controversia, las partes se someten a los tribunales ordinarios de la ciudad de Paraná, constituyendo domicilios en los indicados al inicio.

En prueba de conformidad, se firman dos ejemplares de un mismo tenor y a un solo efecto.

| LA COOPERATIVA | EL GENERADOR |
|---|---|
| Firma: ____________ | Firma: ____________ |
| Aclaración: {{coop.representante}} | Aclaración: {{cliente.representante}} |
