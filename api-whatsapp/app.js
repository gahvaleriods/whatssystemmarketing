const { Client, LocalAuth, List, Buttons, MessageMedia } = require('whatsapp-web.js');
const express = require('express');
const { body, validationResult } = require('express-validator');
const socketIO = require('socket.io');
const qrcode = require('qrcode');
const http = require('http');
const fileUpload = require('express-fileupload');
const axios = require('axios');
const mime = require('mime-types');
const port = process.env.PORT || 8000;
const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// Express
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(fileUpload({ debug: true }));
// Frontend - Assets CSS and JS
app.use("/assets", express.static(__dirname + "/front/assets"))
app.get("/", (req, res) => {
	res.sendFile("./front/index.html", {
		root: __dirname
	})
})

// Client
const client = new Client({
  authStrategy: new LocalAuth({ clientId: 'whatsapp-api' }),
  puppeteer: { headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-gpu'
    ] }
});

client.initialize();

// Authenticated
io.on('connection', function(socket) {
  socket.emit('message', 'Conectando, aguarde...');

client.on('qr', (qr) => {
    console.log('QR RECEIVED', qr);
    qrcode.toDataURL(qr, (err, url) => {
      socket.emit('qr', url);
      socket.emit('message', 'QRCode recebido, aponte a câmera  seu celular!');
    });
});

client.on('ready', () => {
    socket.emit('ready', "./assets/check.svg");
    socket.emit('message', '🙂 Pronto, Whatsapp Conectado!');	
    console.log('Whatsapp Conectado');
});

client.on('authenticated', () => {
    socket.emit('authenticated', 'Whatsapp Autenticado!');
    socket.emit('message', 'Whatsapp Autenticado!');
    console.log('Whatsapp Autenticado');
});

client.on('auth_failure', function() {
    socket.emit('message', 'Falha na autenticação, reiniciando...');
    console.error('Falha na autenticação');
});

client.on('change_state', state => {
  console.log('Status de conexão: ', state );
});

client.on('disconnected', (reason) => {
  socket.emit('message', 'Cliente desconectado!');
  console.log('Cliente desconectado', reason);
  client.initialize();
});
});

// Verifica se é um número de Whatsapp
const checkRegisteredNumber = async function(number) {
  const isRegistered = await client.isRegisteredUser(number);
  return isRegistered;
}

// Enviar mensagem
app.post('/send-message', [
  body('number').notEmpty(),
  body('message').notEmpty(),
], async (req, res) => {
  const errors = validationResult(req).formatWith(({
    msg
  }) => {
    return msg;
  });

  if (!errors.isEmpty()) {
    return res.status(422).json({
      status: false,
      message: errors.mapped()
    });
  }

  const number = req.body.number + "@c.us";
  const message = req.body.message;

  const isRegisteredNumber = await checkRegisteredNumber(number);
  if (!isRegisteredNumber) {
    return res.status(422).json({
      status: false,
      message: 'O número não está registrado no Whatsapp'
    });
  }

  client.sendMessage(number, message).then(response => {
    res.status(200).json({
      status: true,
      message: 'Mensagem enviada',
      response: response
    });
    }).catch(err => {
    res.status(500).json({
      status: false,
      message: 'Mensagem não enviada',
      response: err.text
    });
    });
});

// Enviar imagem
app.post('/send-media', async (req, res) => {
  const number = req.body.number + "@c.us";
  const caption = req.body.caption;
  const fileUrl = req.body.file;

  let mimetype;
  const attachment = await axios.get(fileUrl, {
    responseType: 'arraybuffer'
  }).then(response => {
    mimetype = response.headers['content-type'];
    return response.data.toString('base64');
  });

  const media = new MessageMedia(mimetype, attachment, 'Media');

  const isRegisteredNumber = await checkRegisteredNumber(number);
  if (!isRegisteredNumber) {
    return res.status(422).json({
      status: false,
      message: 'O número não está registrado no Whatsapp'
    });
  }

  client.sendMessage(number, media, {caption: caption}).then(response => {
    res.status(200).json({
      status: true,
      message: 'Imagem enviada',
      response: response
    });
    }).catch(err => {
    res.status(500).json({
      status: false,
      message: 'Imagem não enviada',
      response: err.text
    });
    });
});

// Enviar botões
app.post('/send-button', [
  body('number').notEmpty(),
  body('buttonBody').notEmpty(),
  body('bt1').notEmpty(),
  body('bt2').notEmpty(),
  body('bt3').notEmpty(),
  body('buttonTitle').notEmpty(),
  body('buttonFooter').notEmpty()
  
], async (req, res) => {
  const errors = validationResult(req).formatWith(({
    msg
  }) => {
    return msg;
  });

  if (!errors.isEmpty()) {
    return res.status(422).json({
      status: false,
      message: errors.mapped()
    });
  }

  const number = req.body.number + '@c.us';
  const buttonBody = req.body.buttonBody;
  const bt1 = req.body.bt1;
  const bt2 = req.body.bt2;
  const bt3 = req.body.bt3;
  const buttonTitle = req.body.buttonBody;
  const buttonFooter = req.body.buttonFooter;
  const button = new Buttons(buttonBody,[{body:bt1},{body:bt2},{body:bt3}],buttonTitle,buttonFooter);

  const isRegisteredNumber = await checkRegisteredNumber(number);
  if (!isRegisteredNumber) {
    return res.status(422).json({
      status: false,
      message: 'O número não está registrado no Whatsapp'
    });
  }

  client.sendMessage(number, button).then(response => {
    res.status(200).json({
      status: true,
      response: response
    });
  }).catch(err => {
    res.status(500).json({
      status: false,
      response: err
    });
  });
});

// Enviar listas
app.post('/send-list', [
  body('number').notEmpty(),
  body('ListItem1').notEmpty(),
  body('desc1').notEmpty(),
  body('ListItem2').notEmpty(),
  body('desc2').notEmpty(),
  body('List_body').notEmpty(),
  body('btnText').notEmpty(),
  body('Title').notEmpty(),
  body('footer').notEmpty()
  
], async (req, res) => {
  const errors = validationResult(req).formatWith(({
    msg
  }) => {
    return msg;
  });

  if (!errors.isEmpty()) {
    return res.status(422).json({
      status: false,
      message: errors.mapped()
    });
  }

  const number = req.body.number + '@c.us';
  const sectionTitle = req.body.sectionTitle;
  const ListItem1 = req.body.ListItem1;
  const desc1 = req.body.desc1;
  const ListItem2 = req.body.ListItem2;
  const desc2 = req.body.desc2;
  const List_body = req.body.List_body;
  const btnText = req.body.btnText;
  const Title = req.body.Title;
  const footer = req.body.footer;

  const sections = [{title:sectionTitle,rows:[{title:ListItem1, description: desc1},{title:ListItem2, description: desc2}]}];
  const list = new List(List_body,btnText,sections,Title,footer);

  const isRegisteredNumber = await checkRegisteredNumber(number);

  if (!isRegisteredNumber) {
    return res.status(422).json({
      status: false,
      message: 'O número não está registrado no Whatsapp'
    });
  }

  client.sendMessage(number, list).then(response => {
    res.status(200).json({
      status: true,
      response: response
    });
  }).catch(err => {
    res.status(500).json({
      status: false,
      response: err
    });
  });
});

// Enviar mensagem em grupo
// Usei o ID do Grupo ou nome
app.post('/send-group-message', [
  body('id').custom((value, { req }) => {
    if (!value && !req.body.name) {
      throw new Error('Valor inválido, use `id` ou `name`');
    }
    return true;
  }),
  body('message').notEmpty(),
], async (req, res) => {
  const errors = validationResult(req).formatWith(({
    msg
  }) => {
    return msg;
  });

  if (!errors.isEmpty()) {
    return res.status(422).json({
      status: false,
      message: errors.mapped()
    });
  }

  let chatId = req.body.id;
  const groupName = req.body.name;
  const message = req.body.message;

  // Find the group by name
  if (!chatId) {
    const group = await findGroupByName(groupName);
    if (!group) {
      return res.status(422).json({
        status: false,
        message: 'Nenhum grupo encontrado com nome: ' + groupName
      });
    }
    chatId = group.id._serialized;
  }
console.log(chatId);
  client.sendMessage(chatId, message).then(response => {
    res.status(200).json({
      status: true,
      id: chatId,
      response: response
    });
  }).catch(err => {
    res.status(500).json({
      status: false,
      response: err + chatId
    });
  });
});
const findGroupByName = async function(name) {
  const group = await client.getChats().then(chats => {
    return chats.find(chat => 
      chat.isGroup && chat.name.toLowerCase() == name.toLowerCase()
    );
  });
  return group;
}
    
server.listen(port, function() {
        console.log('Api de Whatsapp rodando na porta *: ' + port);
});