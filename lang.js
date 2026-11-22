// English / Spanish switch for 559eats.
// Swaps visible text using the word list below and remembers the choice on this device.
// Headings in the Matcha Boom font only switch when the Spanish fits the font's letters
// (no accents, ñ, ¿ or ¡). If not, the whole heading stays in English so it never renders broken.
(function () {
  var ES = {
"Browse": "Explorar",
"Map": "Mapa",
"Events": "Eventos",
"Catering": "Catering",
"List your truck": "Anúnciese",
"Pricing": "Precios",
"About": "Nosotros",
"Contact": "Contacto",
"Terms & Privacy": "Términos y privacidad",
"Menu": "Menú",
"Browse trucks": "Ver food trucks",
"List your truck (free)": "Anuncie su truck (gratis)",
"Owner login": "Acceso de propietarios",
"Food truck map": "Mapa de food trucks",
"Fresno, Clovis & the Central Valley": "Fresno, Clovis y el Valle Central",
"📍 Near me": "📍 Cerca de mí",
"Near me": "Cerca de mí",
"Loading trucks...": "Cargando food trucks...",
"Loading trucks…": "Cargando food trucks…",
"Open": "Abierto",
"Here now": "Aquí ahora",
"Closed": "Cerrado",
"No hours": "Sin horario",
"☰ List": "☰ Lista",
"Search trucks, food, area...": "Busque trucks, comida, zona...",
"Sort by distance from you": "Ordenar por distancia",
"Show my location": "Mostrar mi ubicación",
"Could not find your location. Try again.": "No pudimos encontrar su ubicación. Intente de nuevo.",
"Location is not available on this device": "La ubicación no está disponible en este dispositivo",
"Could not load trucks. Please refresh.": "No se pudieron cargar los food trucks. Actualice la página.",
"No trucks match that.": "Ningún food truck coincide.",
"Closed for today": "Cerrado por hoy",
"Closed now": "Cerrado ahora",
"Closed today": "Cerrado hoy",
"Hours not posted": "Horario no publicado",
"Hours not posted yet": "Horario aún no publicado",
"Parked now": "Estacionado ahora",
"Directions": "Cómo llegar",
"Details": "Detalles",
"Call": "Llamar",
"Share": "Compartir",
"Save": "Guardar",
"Info": "Info",
"Phone": "Teléfono",
"Website": "Sitio web",
"Payment": "Pago",
"Link copied": "Enlace copiado",
"Today's special": "Especial de hoy",
"Usual spot": "Lugar de siempre",
"Trucks move. Check the status above before you head out.": "Los food trucks se mueven. Revise el estado de arriba antes de salir.",
"Book this truck for an event": "Reserve este truck para un evento",
"Truck not found": "Food truck no encontrado",
"Food truck": "Food truck",
"Monday": "Lunes",
"Tuesday": "Martes",
"Wednesday": "Miércoles",
"Thursday": "Jueves",
"Friday": "Viernes",
"Saturday": "Sábado",
"Sunday": "Domingo",
"Fresno · Clovis · Central Valley": "Fresno · Clovis · Valle Central",
"Browse food trucks": "Explore los food trucks",
"Every truck on 559eats, with who’s open now and where they’re parked today.": "Todos los food trucks de 559eats: quién está abierto ahora y dónde están estacionados hoy.",
"Sort: Best match": "Orden: Mejor resultado",
"Sort: A to Z": "Orden: A a la Z",
"Sort: Open now first": "Orden: Abiertos primero",
"Food trucks in Fresno": "Food trucks en Fresno",
"Food trucks in Clovis": "Food trucks en Clovis",
"Taco trucks Fresno": "Taqueros en Fresno",
"Birria Fresno": "Birria en Fresno",
"List your food truck": "Anuncie su food truck",
"559eats · Celebrating local food in the Central Valley": "559eats · Celebrando la comida local del Valle Central",
"Truck nights & pop-ups": "Noches de trucks y pop-ups",
"Food truck events": "Eventos de food trucks",
"Where the trucks are gathering around Fresno, Clovis and the Central Valley.": "Dónde se juntan los food trucks en Fresno, Clovis y el Valle Central.",
"Loading events...": "Cargando eventos...",
"Could not load events. Please refresh.": "No se pudieron cargar los eventos. Actualice la página.",
"Hosting an event and need trucks?": "Food trucks para su evento",
"Breweries, churches, schools and businesses: we can bring the trucks.": "Cervecerías, iglesias, escuelas y negocios: nosotros le llevamos los food trucks.",
"Request trucks for your event": "Pida food trucks para su evento",
"Catering & events": "Catering y eventos",
"Book a food truck": "Reserve un food truck",
"for your next event": "para su siguiente evento",
"Connect with Fresno’s best food trucks for weddings, corporate lunches, parties, and more — all in one place.": "Conecte con los mejores food trucks de Fresno para bodas, comidas de empresa, fiestas y más, todo en un solo lugar.",
"💍 Weddings": "💍 Bodas",
"💼 Corporate": "💼 Empresas",
"🎂 Birthdays": "🎂 Cumpleaños",
"🎓 Graduations": "🎓 Graduaciones",
"🏫 School events": "🏫 Eventos escolares",
"🏫 Pop-ups": "🏫 Pop-ups",
"How it works": "Paso a paso",
"Getting a food truck for your event is easier than you think": "Conseguir un food truck para su evento es más fácil de lo que cree",
"Fill out the form": "Llene el formulario",
"Tell us your event date, location, expected guest count, and food preferences.": "Díganos la fecha, el lugar, cuántos invitados espera y qué comida prefiere.",
"We match you": "Le buscamos opciones",
"We reach out to available trucks in our network that fit your event.": "Contactamos a los food trucks disponibles que van con su evento.",
"Get quotes": "Reciba cotizaciones",
"Trucks send you quotes directly. You choose the best fit for your budget and vibe.": "Los food trucks le mandan su cotización directamente. Usted elige el que mejor va con su presupuesto y estilo.",
"Enjoy the food": "Disfrute la comida",
"Sit back and let the truck handle the food while you enjoy the event.": "Relájese y deje que el truck se encargue de la comida mientras disfruta su evento.",
"Available trucks": "Food trucks disponibles",
"List your truck →": "Anuncie su truck →",
"Request a quote": "Solicite precios",
"Fill this out and we’ll connect you with the right trucks within 24 hours.": "Llene esto y lo conectamos con los food trucks indicados en menos de 24 horas.",
"Your name *": "Su nombre *",
"Your name": "Su nombre",
"Phone *": "Teléfono *",
"Email": "Correo electrónico",
"Event date *": "Fecha del evento *",
"Guest count": "Número de invitados",
"Event type": "Tipo de evento",
"Wedding": "Boda",
"Corporate event": "Evento de empresa",
"Birthday party": "Fiesta de cumpleaños",
"Graduation": "Graduación",
"School event": "Evento escolar",
"Pop-up / market": "Pop-up / mercado",
"Other": "Otro",
"Preferred cuisine": "Comida preferida",
"Start time": "Hora de inicio",
"End time": "Hora de fin",
"Budget": "Presupuesto",
"Select a range": "Elija un rango",
"Under $500": "Menos de $500",
"$500 to $1,000": "$500 a $1,000",
"$1,000 to $2,500": "$1,000 a $2,500",
"$2,500 to $5,000": "$2,500 a $5,000",
"Event location / address": "Lugar / dirección del evento",
"Additional details": "Más detalles",
"Request catering quote →": "Pedir cotización de catering →",
"By sending a request you agree to our": "Al enviar su solicitud acepta nuestros",
". Your booking is with the truck you choose.": ". Su reservación es con el truck que usted elija.",
"✓ Quote request received! We’ll connect you with available trucks within 24 hours.": "✓ ¡Recibimos su solicitud! Lo conectamos con food trucks disponibles en menos de 24 horas.",
"e.g. Mexican, BBQ, anything": "ej. mexicana, BBQ, lo que sea",
"Fresno or Clovis area": "Zona de Fresno o Clovis",
"Dietary needs, theme, special requests…": "Dietas especiales, tema, peticiones…",
"Free listing": "Anuncio gratis",
"Get your spot on the map": "Ponga su comida en el mapa",
"Put your food truck on the 559eats map so Fresno and Central Valley locals can find you. It’s free.": "Ponga su food truck en el mapa de 559eats para que la gente de Fresno y el Valle Central lo encuentre. Es gratis.",
"Why list on 559eats?": "Lo que gana con 559eats",
"559eats is a local map of Fresno and Central Valley food trucks. Your listing shows people what you serve, when you’re open, and where to find you.": "559eats es un mapa local de food trucks de Fresno y el Valle Central. Su anuncio muestra lo que vende, cuándo abre y dónde encontrarlo.",
"Free forever": "Gratis para siempre",
"Listing is free and we take no cut of your window sales. We charge 15% on catering jobs we book for you and you accept. Optional map glow from $1 a month.": "El anuncio es gratis y no cobramos nada de sus ventas en la ventanilla. Cobramos 15% en los trabajos de catering que le conseguimos y usted acepta. Brillo opcional en el mapa desde $1 al mes.",
"See pricing": "Ver precios",
"Photo-first profile": "Perfil con fotos",
"Showcase your food with a full photo gallery customers can browse.": "Presuma su comida con una galería de fotos que los clientes pueden ver.",
"Map & search visibility": "Visible en el mapa y en búsquedas",
"Show up when locals search by neighborhood, cuisine, or category.": "Aparezca cuando la gente busque por zona, tipo de comida o categoría.",
"SMS onboarding": "Registro por mensaje de texto",
"We’ll text you to gather your info — no paperwork required.": "Le mandamos un texto para pedir sus datos, sin papeleo.",
"Catering leads": "Clientes de catering",
"Get discovered by event planners and corporate clients looking to book.": "Que lo encuentren organizadores de eventos y empresas que buscan reservar.",
"Food truck owner? Text us instead.": "¿Tiene un food truck? Mejor mándenos un texto.",
"Text JOIN to": "Mande JOIN al",
"Our assistant will ask a few quick questions to list your truck for free. Message frequency varies. Msg and data rates may apply. Reply HELP for help, STOP to opt out. See our": "Nuestro asistente le hará unas preguntas rápidas para anunciar su truck gratis. La frecuencia de mensajes varía. Pueden aplicar cargos por mensajes y datos. Responda HELP para ayuda, STOP para cancelar. Vea nuestros",
"SMS Terms and Privacy Policy": "Términos de SMS y Política de privacidad",
"Tell us about your spot": "Datos de su negocio",
"Truck name *": "Nombre del truck *",
"Type *": "Tipo *",
"Select...": "Elija...",
"Food Truck": "Food truck",
"Food Cart": "Carrito de comida",
"Pop-up": "Pop-up",
"Owner / Contact name *": "Nombre del dueño o contacto *",
"Phone number *": "Número de teléfono *",
"Email address *": "Correo electrónico *",
"Cuisine / Category": "Tipo de comida / categoría",
"Neighborhood / Area": "Colonia / zona",
"Address or regular location": "Dirección o lugar de siempre",
"Instagram handle": "Usuario de Instagram",
"Optional but highly recommended — it drives follows and engagement.": "Opcional pero muy recomendado: le trae más seguidores.",
"Anything else you’d like us to know?": "¿Algo más que quiera contarnos?",
"Text me about my listing (setup, hours and location updates, catering requests). Message frequency varies. Msg & data rates may apply. Reply HELP for help, STOP to opt out. Consent is not required to be listed. See our": "Mándenme textos sobre mi anuncio (configuración, cambios de horario y ubicación, pedidos de catering). La frecuencia de mensajes varía. Pueden aplicar cargos por mensajes y datos. Responda HELP para ayuda, STOP para cancelar. No necesita aceptar para aparecer en el mapa. Vea nuestros",
"SMS terms & privacy": "términos de SMS y privacidad",
"Submit for free listing →": "Enviar para anuncio gratis →",
"By submitting you agree to our": "Al enviar acepta nuestros",
"and": "y",
"SMS terms": "términos de SMS",
"SMS Terms": "Términos de SMS",
"You’re on the list!": "Lo recibimos",
"We’ll be in touch via text within 1–2 business days to get your listing live.": "Le mandaremos un texto en 1 a 2 días hábiles para activar su anuncio.",
"e.g. Taqueria El Rey": "ej. Taquería El Rey",
"e.g. Mexican, BBQ, Asian Fusion": "ej. mexicana, BBQ, fusión asiática",
"e.g. Tower District, Clovis": "ej. Tower District, Clovis",
"Street address or “Rotating — check Instagram”": "Dirección o “Cambia de lugar, ver Instagram”",
"Hours, specialties, upcoming events, catering availability…": "Horario, especialidades, próximos eventos, si hace catering…",
"For food trucks": "Para food trucks",
"Simple, fair pricing": "Precios simples y justos",
"Listing your truck is free. Pay only if you want to glow on the map, or when we book you a catering job.": "Anunciar su truck es gratis. Solo paga si quiere brillar en el mapa, o cuando le conseguimos un trabajo de catering.",
"🚚 Free listing": "🚚 Anuncio gratis",
"forever": "para siempre",
"Your truck on the 559eats map": "Su truck en el mapa de 559eats",
"Your own page with menu, photos and hours": "Su propia página con menú, fotos y horario",
"Post today's spot by text or from your dashboard": "Publique dónde está hoy por texto o desde su panel",
"Daily specials and open/closed updates": "Especiales del día y avisos de abierto/cerrado",
"Catering requests from local customers": "Pedidos de catering de clientes locales",
"List my truck free": "Anunciar mi truck gratis",
"/ month": "/ mes",
"Everything in the free listing": "Todo lo del anuncio gratis",
"Orange glow around your map pin": "Brillo naranja alrededor de su pin",
"Listed above free trucks": "Aparece arriba de los trucks gratis",
"Spotlight badge on your page": "Insignia Spotlight en su página",
"Choose Spotlight": "Elegir Spotlight",
"Everything in Spotlight": "Todo lo de Spotlight",
"Gold glow and star on your pin": "Brillo dorado y estrella en su pin",
"Listed above Spotlight trucks": "Aparece arriba de los trucks Spotlight",
"Featured badge on your page": "Insignia Featured en su página",
"Choose Featured": "Elegir Featured",
"Everything in Featured": "Todo lo de Featured",
"Biggest pulsing gold glow and a bigger pin": "El brillo dorado más grande, con pulso, y un pin más grande",
"Your name always showing on the map": "Su nombre siempre visible en el mapa",
"Never hidden inside a cluster": "Nunca escondido en un grupo de pins",
"Top of the list and search": "Primero en la lista y en búsquedas",
"Choose Premium": "Elegir Premium",
"Already listed? Log in and open the Billing tab to pick a plan. Switch or cancel anytime. New?": "¿Ya está en el mapa? Entre y abra la pestaña Billing para elegir un plan. Cambie o cancele cuando quiera. ¿Es nuevo?",
"List free first": "Anúnciese gratis primero",
"🍴 Catering we bring you: 15%": "🍴 Catering que le conseguimos: 15%",
"When a customer books your truck for an event through 559eats and you accept it, we charge a 15% booking fee on the price you agreed with the customer (never more than 15% of the top of their budget range). You only pay on jobs you confirm. We never take a cut of your everyday sales at the window.": "Cuando un cliente reserva su truck para un evento por medio de 559eats y usted lo acepta, cobramos una comisión de 15% sobre el precio que acordó con el cliente (nunca más del 15% del tope de su rango de presupuesto). Solo paga por los trabajos que confirma. Nunca cobramos nada de sus ventas diarias en la ventanilla.",
"Common questions": "Preguntas frecuentes",
"Do I have to pay to be on the map?": "¿Tengo que pagar para estar en el mapa?",
"No. The listing is free and stays free.": "No. El anuncio es gratis y sigue siendo gratis.",
"What is the difference between the plans?": "¿Cuál es la diferencia entre los planes?",
"All three make your pin glow and move you up the list. Premium has the biggest, pulsing glow, a bigger pin with your name always showing, and is never grouped into a cluster bubble. Featured has a gold glow and star. Spotlight has a softer orange glow.": "Los tres hacen brillar su pin y lo suben en la lista. Premium tiene el brillo más grande, con pulso, un pin más grande con su nombre siempre visible, y nunca se agrupa con otros pins. Featured tiene brillo dorado y estrella. Spotlight tiene un brillo naranja más suave.",
"How do I switch or cancel?": "¿Cómo cambio o cancelo?",
"When does the 15% catering fee get charged?": "¿Cuándo se cobra la comisión de 15% de catering?",
"Only when you confirm a catering booking that came through 559eats. You enter the price you agreed on, and 15% of it is charged right away to the card saved in your dashboard. Declined or canceled requests cost nothing.": "Solo cuando confirma una reservación de catering que llegó por 559eats. Usted escribe el precio acordado y se cobra el 15% en ese momento a la tarjeta guardada en su panel. Las solicitudes rechazadas o canceladas no cuestan nada.",
"Is my card safe?": "¿Mi tarjeta está segura?",
"Payments are handled by Stripe. 559eats never sees or stores your full card number.": "Los pagos los maneja Stripe. 559eats nunca ve ni guarda el número completo de su tarjeta.",
"Our story": "Nuestra historia",
"Built for the 559": "Hecho para el 559",
"559eats started with one simple idea: local food deserves a local spotlight.": "559eats empezó con una idea simple: la comida local merece que la conozcan.",
"Made in the 559": "Hecho en el 559",
"Fresno has some of the best food trucks in California: family taco trucks in Southeast Fresno, birria on Belmont, mariscos on Shields, shawarma up north. Most of them have no website, so the only way to find them is to drive around or know someone. 559eats fixes that.": "Fresno tiene algunos de los mejores food trucks de California: taqueros familiares en el sureste de Fresno, birria en la Belmont, mariscos en la Shields, shawarma en el norte. La mayoría no tiene sitio web, así que la única forma de encontrarlos es manejar por ahí o conocer a alguien. 559eats lo resuelve.",
"Free for everyone": "Gratis para todos",
"We don’t charge food trucks to be listed. Local food shouldn’t have to pay a platform just to be found.": "No les cobramos a los food trucks por aparecer. La comida local no debería pagarle a una plataforma solo para que la encuentren.",
"Hyper-local focus": "Cien por ciento local",
"We only cover the Central Valley. No national chains, no LA noise. If it’s in the 559, we want it on the map.": "Solo cubrimos el Valle Central. Nada de cadenas nacionales ni de LA. Si está en el 559, lo queremos en el mapa.",
"Community-driven": "Hecho por la comunidad",
"Owners post their own hours, specials and where they’re parked today, right from their phone.": "Los dueños publican su horario, especiales y dónde están hoy, desde su celular.",
"Mobile-first discovery": "Pensado para el celular",
"Most people decide where to eat on their phone, standing somewhere hungry. The map is built for that moment.": "Casi todos deciden dónde comer desde el celular, parados en algún lado con hambre. El mapa está hecho para ese momento.",
"The story behind 559eats": "La historia de 559eats",
"It started as a frustration: great food trucks in Fresno with no online presence, spots only regulars knew about, and no single place to see who’s open right now.": "Empezó por una frustración: food trucks buenísimos en Fresno sin presencia en internet, lugares que solo conocían los clientes de siempre, y ningún sitio para ver quién está abierto ahorita.",
"So we built one: a live map of Fresno and Central Valley food trucks that shows who’s open, where they’re parked today, and how to book them for your next event.": "Así que hicimos uno: un mapa en vivo de los food trucks de Fresno y el Valle Central que muestra quién está abierto, dónde están hoy y cómo reservarlos para su siguiente evento.",
"We’re proud to be a Fresno-born project, built by and for the Central Valley community.": "Estamos orgullosos de ser un proyecto nacido en Fresno, hecho por y para la comunidad del Valle Central.",
"The area code that defines us": "El 559 nos define",
"Food trucks on the map": "Food trucks en el mapa",
"Own a spot in the 559?": "Para negocios del 559",
"Get your food truck on the map, free. No cut of your everyday sales. We only charge a 15% fee on catering jobs we book for you and you accept, and an optional $1 to $6 a month if you want your truck to glow on the map.": "Ponga su food truck en el mapa, gratis. No cobramos nada de sus ventas diarias. Solo cobramos una comisión de 15% en trabajos de catering que le conseguimos y usted acepta, y de $1 a $6 al mes opcionales si quiere que su truck brille en el mapa.",
"List your spot for free →": "Anúnciese gratis →",
"Get in touch": "Contáctenos",
"We’d love to hear from you": "Hablemos",
"Questions, partnerships, media inquiries — we’re here.": "Preguntas, alianzas, prensa: aquí estamos.",
"Say hello": "Mande un saludo",
"Whether you have a question about a listing, want to partner with us, or just love local food — reach out.": "Ya sea que tenga una pregunta sobre un anuncio, quiera trabajar con nosotros o simplemente le encante la comida local, escríbanos.",
"General inquiries": "Preguntas generales",
"Use our free listing form — we’ll text you to get started.": "Use nuestro formulario gratis y le mandamos un texto para empezar.",
"Apply now →": "Regístrese →",
"Media & press": "Medios y prensa",
"Fresno & Central Valley": "Fresno y el Valle Central",
"559eats is proud to be local. We cover Fresno, Clovis, Visalia, and beyond.": "559eats es orgullosamente local. Cubrimos Fresno, Clovis, Visalia y más.",
"Send a message": "Mande un mensaje",
"Subject": "Asunto",
"General question": "Pregunta general",
"Listing inquiry": "Pregunta sobre un anuncio",
"Partnership": "Alianza",
"Media / press": "Medios / prensa",
"Bug report": "Reportar un error",
"Message": "Mensaje",
"Send message →": "Enviar mensaje →",
"✓ Message sent! We’ll get back to you within 1–2 business days.": "✓ ¡Mensaje enviado! Le respondemos en 1 a 2 días hábiles.",
"What’s on your mind?": "¿En qué le podemos ayudar?",
"Sign in with Google, or enter your email and we'll send you a sign-in link. No password needed.": "Entre con Google, o escriba su correo y le mandamos un enlace para entrar. No necesita contraseña.",
"Continue with Google": "Continuar con Google",
"or": "o",
"Your email address": "Su correo electrónico",
"Send magic link": "Mandar enlace",
"✅ Magic link sent! Check your inbox and click the link to log in.": "✅ ¡Enlace enviado! Revise su correo y toque el enlace para entrar.",
"Didn't get it?": "¿No le llegó?",
"Check your spam folder or try again.": "Revise la carpeta de spam o intente de nuevo.",
"Not listed yet?": "¿Todavía no está en el mapa?",
"Apply to list your food truck →": "Anuncie su food truck →",
"← Back to 559eats": "← Volver a 559eats",
"Loading your claim link...": "Cargando su enlace...",
"Claim your truck": "Reclame su food truck",
"Your listing on the 559eats map is free. Claim it to post your hours, where you're parked today, your menu and photos.": "Su anuncio en el mapa de 559eats es gratis. Reclámelo para publicar su horario, dónde está hoy, su menú y fotos.",
"Your email": "Su correo",
"Email me a sign-in link": "Mándenme un enlace para entrar",
"Check your email and tap the link. It brings you right back here to finish.": "Revise su correo y toque el enlace. Lo regresa aquí mismo para terminar.",
"Linking your account...": "Conectando su cuenta...",
"Questions? Email": "¿Preguntas? Escriba a",
". By claiming you agree to our": ". Al reclamarlo acepta nuestros",
"Terms": "Términos",
"This page went off the menu": "Esta página ya no está en el menú",
"The page you’re looking for doesn’t exist — but great food definitely does. Try heading back to the homepage.": "La página que busca no existe, pero la buena comida sí. Regrese a la página principal.",
"🏠 Back to 559eats": "🏠 Volver a 559eats",
"Browse all spots": "Ver todos los trucks",
"Loading…": "Cargando…",
"📍 Where we are today": "📍 Lugar de hoy",
"Photos": "Fotos",
"Hours": "Horario",
"Is this your truck?": "¿Este es su truck?",
"Owner sign in": "Acceso del dueño",
"claim this listing": "reclame este anuncio",
"to update your hours, location and menu.": "para actualizar su horario, ubicación y menú.",
"More trucks": "Otros food trucks",
"Truck map": "Mapa de trucks",
"For trucks": "Para trucks",
"Book a truck": "Reserve un truck",
"Hours & menu": "Horario y menú",
"List it free": "Anúncielo gratis",
"No trucks listed here yet.": "Todavía no hay food trucks aquí.",
"Open the live map": "Abrir el mapa en vivo",
"See on map": "Ver en el mapa",
"Log in and open Billing. Pick another plan to switch (the price difference is prorated), or tap \"Cancel at end of month\". You keep your plan until the month you paid for ends, then go back to the free listing automatically.": "Entre y abra Billing. Elija otro plan para cambiar (la diferencia de precio se prorratea), o toque \"Cancel at end of month\". Conserva su plan hasta que termine el mes que pagó y luego regresa al anuncio gratis automáticamente."
};
  var PATTERNS = [
    [/^Open now · until (.+)$/, 'Abierto ahora · hasta las $1'],
    [/^Here now · until (.+)$/, 'Aquí ahora · hasta las $1'],
    [/^Opens at (.+)$/, 'Abre a las $1'],
  ];
  // Every character Matcha Boom can draw.
  var MB = "!\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~ ¢£¤¥­±¶×÷‘’“”…€™−";
  var KEY = '559eats_lang';
  var ATTRS = ['placeholder', 'aria-label', 'title'];
  var SKIP = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEXTAREA: 1, svg: 1, CODE: 1 };

  var orig = new Map();      // text node -> English text
  var applied = new Map();   // text node -> Spanish text we put there
  var lang = 'en';
  var observer = null;
  var keptEnglish = [];

  function norm(s) { return s.replace(/\s+/g, ' ').trim(); }
  function lookup(key) {
    if (Object.prototype.hasOwnProperty.call(ES, key)) return ES[key];
    for (var i = 0; i < PATTERNS.length; i++) if (PATTERNS[i][0].test(key)) return key.replace(PATTERNS[i][0], PATTERNS[i][1]);
    return null;
  }
  function isMatcha(el) {
    if (!el || el.nodeType !== 1) return false;
    var f = getComputedStyle(el).fontFamily || '';
    return /^["']?matcha boom/i.test(f.trim());
  }
  function fits(es, en) {
    for (var i = 0; i < es.length; i++) {
      var c = es[i];
      if (MB.indexOf(c) === -1 && en.indexOf(c) === -1 && !/\s/.test(c) && c.charCodeAt(0) < 0x2190) return false;
    }
    return true;
  }
  function skipped(node) {
    for (var el = node.parentElement; el; el = el.parentElement) {
      if (SKIP[el.tagName] || el.hasAttribute('data-notr')) return true;
    }
    return false;
  }
  function setText(node, en, es) {
    var lead = en.match(/^\s*/)[0], tail = en.match(/\s*$/)[0];
    orig.set(node, en);
    var v = lead + es + tail;
    applied.set(node, v);
    node.nodeValue = v;
  }

  function translate(root) {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    var groups = new Map(), n;
    while ((n = walker.nextNode())) {
      if (!/[A-Za-z]/.test(n.nodeValue)) continue;
      if (applied.has(n) && applied.get(n) === n.nodeValue) continue; // already Spanish
      if (skipped(n)) continue;
      var en = n.nodeValue, es = lookup(norm(en));
      var p = n.parentElement;
      if (p && isMatcha(p)) {
        // Group every text piece of one brand-font heading so it switches all at once or not at all.
        var g = p;
        while (g.parentElement && isMatcha(g.parentElement) && g.parentElement !== document.body) g = g.parentElement;
        if (!groups.has(g)) groups.set(g, []);
        groups.get(g).push([n, en, es]);
        continue;
      }
      if (es != null) {
        if (p && p.tagName === 'OPTION' && !p.hasAttribute('value')) p.setAttribute('value', norm(en)); // keep form answers in English
        setText(n, en, es);
      }
    }
    groups.forEach(function (items, g) {
      if (items.every(function (it) { return it[2] == null; })) return; // nothing to translate (logo, truck names)
      var ok = items.every(function (it) { return it[2] != null && fits(it[2], it[1]); });
      if (!ok) { var t = norm(g.textContent); if (keptEnglish.indexOf(t) < 0) keptEnglish.push(t); return; }
      items.forEach(function (it) { setText(it[0], it[1], it[2]); });
    });
    root.querySelectorAll && root.querySelectorAll('[placeholder],[aria-label],[title]').forEach(function (el) {
      if (el.hasAttribute('data-notr')) return;
      ATTRS.forEach(function (a) {
        var v = el.getAttribute(a);
        if (!v) return;
        var saved = el.getAttribute('data-en-' + a);
        if (saved != null && el.getAttribute('data-es-' + a) === v) return;
        var es = lookup(norm(v));
        if (es == null) return;
        el.setAttribute('data-en-' + a, v);
        el.setAttribute('data-es-' + a, es);
        el.setAttribute(a, es);
      });
    });
  }

  function restore() {
    orig.forEach(function (en, node) {
      if (node.nodeValue === applied.get(node)) node.nodeValue = en;
    });
    orig.clear(); applied.clear();
    ATTRS.forEach(function (a) {
      document.querySelectorAll('[data-en-' + a + ']').forEach(function (el) {
        if (el.getAttribute(a) === el.getAttribute('data-es-' + a)) el.setAttribute(a, el.getAttribute('data-en-' + a));
        el.removeAttribute('data-en-' + a); el.removeAttribute('data-es-' + a);
      });
    });
  }

  var pending = false;
  function watch() {
    if (observer) return;
    observer = new MutationObserver(function () {
      if (pending) return;
      pending = true;
      requestAnimationFrame(function () {
        pending = false;
        if (lang !== 'es') return;
        observer.disconnect();
        translate(document.body);
        observer.observe(document.body, { childList: true, subtree: true, characterData: true });
      });
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  var buttons = [];
  function label() {
    buttons.forEach(function (b) {
      var short = b.getAttribute('data-short') === '1';
      b.textContent = lang === 'es' ? (short ? 'EN' : 'English') : (short ? 'ES' : 'Español');
      b.setAttribute('aria-label', lang === 'es' ? 'View in English' : 'Ver en español');
      b.setAttribute('lang', lang === 'es' ? 'en' : 'es');
    });
  }
  function setLang(l, save) {
    lang = l;
    document.documentElement.lang = l;
    if (save) { try { localStorage.setItem(KEY, l); } catch (e) {} }
    if (l === 'es') { keptEnglish = []; translate(document.body); watch(); }
    else { if (observer) { observer.disconnect(); observer = null; } restore(); }
    label();
    window.__559eatsKeptEnglish = keptEnglish;
  }

  function makeBtn(cls, short) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = cls;
    b.setAttribute('data-notr', '');
    if (short) b.setAttribute('data-short', '1');
    b.addEventListener('click', function (e) { e.preventDefault(); setLang(lang === 'es' ? 'en' : 'es', true); });
    buttons.push(b);
    return b;
  }

  function init() {
    var css = document.createElement('style');
    css.textContent =
      '.lang-btn{display:inline-flex;align-items:center;justify-content:center;background:none;border:1.5px solid #e8e0da;border-radius:999px;padding:6px 12px;min-height:36px;font:inherit;font-size:.82rem;font-weight:700;color:#2d2420;cursor:pointer;margin-right:8px;white-space:nowrap;font-family:Inter,system-ui,sans-serif}' +
      '.lang-btn:hover{border-color:#E8512A;color:#c73e18}' +
      '.lang-float{position:fixed;top:12px;right:12px;z-index:3000;background:#fff;margin:0}' +
      '.mnav-panel .lang-item{display:block;width:100%;text-align:left;background:none;border:0;border-top:1px solid #f0e8e2;margin-top:6px;padding:16px 22px 14px;font:inherit;font-size:1rem;font-weight:600;color:#E8512A;cursor:pointer;font-family:inherit}' +
      '@media (max-width:760px){nav .lang-btn{padding:6px 10px;min-height:40px;margin-right:6px}}';
    document.head.appendChild(css);

    var nav = document.querySelector('nav');
    var cta = nav && nav.querySelector('.nav-cta');
    if (cta) cta.parentNode.insertBefore(makeBtn('lang-btn', true), cta);
    else if (nav) nav.appendChild(makeBtn('lang-btn', true));
    else document.body.appendChild(makeBtn('lang-btn lang-float', true));

    // Also add it to the phone menu (some pages hide the top links entirely on phones).
    var tries = 0;
    (function addToMenu() {
      var panel = document.getElementById('mnav-panel');
      if (panel) { panel.appendChild(makeBtn('lang-item', false)); label(); return; }
      if (nav && ++tries < 20) setTimeout(addToMenu, 100);
    })();

    var q = (location.search.match(/[?&]lang=(es|en)\b/) || [])[1];
    var saved = null;
    try { saved = localStorage.getItem(KEY); } catch (e) {}
    setLang(q || saved || 'en', !!q);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
