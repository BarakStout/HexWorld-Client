$(function() {
  var FADE_TIME = 150; // ms
  var TYPING_TIMER_LENGTH = 400; // ms
  var COLORS = [
    '#e21400', '#91580f', '#f8a700', '#f78b00',
    '#58dc00', '#287b00', '#a8f07a', '#4ae8c4',
    '#3b88eb', '#3824aa', '#a700ff', '#d300e7'
  ];

  var MAX_RESOURCE_QUANTITY = 30000; // UPDATE THIS <<<<<<<<<<<<<<<
  var ASPECT_NAMES = ['army','science','production','diplomacy','growth','development'];

  // Initialize variables
  var $window = $(window);
  var $usernameInput = $('.usernameInput'); // Input for username
  var $messages = $('.messages'); // Messages area
  var $notifications = $('.notifications'); // notifications area
  var $inputMessage = $('.inputMessage'); // Input message input box

  var $loginPage = $('.login.page'); // The login page
  var $chatPage = $('.chat.page'); // The chatroom page

  // Prompt for setting a username
  var username;
  var connected = false;
  var typing = false;
  var lastTypingTime;
  var $currentInput = $usernameInput.focus();

  var socket = io();

  var userList = [];

  var silentMode = false;
  var quietMode = false;
  var blockList = [];

  // ------------ //
  // private info //
  // ------------ //
  function MyAspect(name, shortening, level, quantity) {
    this.name = name;
    this.shortening = shortening;
    this.level = level;
    this.quantity = quantity;
  }

  // ------------ //
  // private info //
  // ------------ //
  function MyEmpire() {
    this.aspects = {
      'army' : new MyAspect('Army','{S}',0,0),
  	  'science' : new MyAspect('Science','[D]',0,0),
  	  'production' : new MyAspect('Production','(G)',0,0),
  	  'diplomacy' : new MyAspect('Diplomacy','#A#',0,0),
  	  'growth' : new MyAspect('Growth','!P!',0,0),
  	  'development' : new MyAspect('Development','>P>',0,0)
    };
  }

  var myEmpire = new MyEmpire();

  const addParticipantsMessage = (data) => {
    var message = '';
    if (data.numUsers === 1) {
      message += "there's 1 participant";
    } else {
      message += "there are " + data.numUsers + " participants";
    }
    log(message);
  }

  // Sets the client's username
  const setUsername = () => {
    username = cleanInput($usernameInput.val().trim());

    // If the username is valid
    if (username) {
      $loginPage.fadeOut();
      $chatPage.show();
      $loginPage.off('click');
      $currentInput = $inputMessage.focus();

      // Tell the server your username
      socket.emit('add user', username);

      updateAspects({'army': [0,5],
                     'science': [0,0],
                     'production': [0,0],
                     'diplomacy': [0,0],
                     'growth': [0,0],
                     'development': [0,0]});
    }
  }

  // Sends a chat messages
  const sendMessage = () => {
    var message = $inputMessage.val();
    // Prevent markup from being injected into the message
    message = cleanInput(message);

    // if there is a non-empty message and a socket connection
    if (message && connected) {
      $inputMessage.val('');

      /*
      addChatMessage({
        username: username,
        message: message
      });*/
      // tell server to execute 'new message' and send along one parameter
      socket.emit('new message', {username, message});
    }
  }

  // Log a message
    const log = (message, options) => {
    var $el = $('<li>').addClass('log').text(message);
    addMessageElement($el, options);
  }

  // Adds the visual chat message to the message list
  const addChatMessage = (data, options) => {

    if(arrayContains(data.username,blockList)) return;
    // Don't fade the message in if there is an 'X was typing'
    var $typingMessages = getTypingMessages(data);
    options = options || {};
    if ($typingMessages.length !== 0) {
      options.fade = false;
      $typingMessages.remove();
    }

    var $usernameDiv = $('<span class="username"/>')
      .text(data.username)
      .css('color', getUsernameColor(data.username));
    var $messageBodyDiv = $('<span class="messageBody">')
      .text(data.message);

    var typingClass = data.typing ? 'typing' : '';
    var $messageDiv = $('<li class="message"/>')
      .data('username', data.username)
      .addClass(typingClass)
      .append($usernameDiv, $messageBodyDiv);

    addMessageElement($messageDiv, options);
  }

  // Adds the visual chat message to the message list
  const addNotificationsMessage = (data, options) => {

    var $usernameDiv = $('<span class="username"/>')
      .text(data.username)
      .css('color', getUsernameColor(data.username));
    var $messageBodyDiv = $('<span class="notificationsBody">')
      .html(data.message);
    var typingClass = data.typing ? 'typing' : '';
    var $messageDiv = $('<li class="notification	"/>')
      .data('username', data.username)
      .addClass(typingClass)
      .append($usernameDiv, $messageBodyDiv);

    addNotificationsElement($messageDiv, options);
  }

  // Adds the visual chat typing message
  const addChatTyping = (data) => {
    data.typing = true;
    data.message = 'is typing';
    addChatMessage(data);
  }

  // Removes the visual chat typing message
  const removeChatTyping = (data) => {
    getTypingMessages(data).fadeOut(function () {
      $(this).remove();
    });
  }

  // Adds a message element to the messages and scrolls to the bottom
  // el - The element to add as a message
  // options.fade - If the element should fade-in (default = true)
  // options.prepend - If the element should prepend
  //   all other messages (default = false)
  const addMessageElement = (el, options) => {
    var $el = $(el);

    // Setup default options
    if (!options) {
      options = {};
    }
    if (typeof options.fade === 'undefined') {
      options.fade = true;
    }
    if (typeof options.prepend === 'undefined') {
      options.prepend = false;
    }

    // Apply options
    if (options.fade) {
      $el.hide().fadeIn(FADE_TIME);
    }
    if (options.prepend) {
      $messages.prepend($el);
    } else {
      $messages.append($el);
    }
    $messages[0].scrollTop = $messages[0].scrollHeight;
  }

  // Adds a message element to the notifications and scrolls to the bottom
  // el - The element to add as a message
  // options.fade - If the element should fade-in (default = true)
  // options.prepend - If the element should prepend
  //   all other notifications (default = false)
  const addNotificationsElement = (el, options) => {
    var $el = $(el);

    // Setup default options
    if (!options) {
      options = {};
    }
    if (typeof options.fade === 'undefined') {
      options.fade = true;
    }
      options.prepend = true;

    // Apply options
    if (options.fade) {
      $el.hide().fadeIn(FADE_TIME);
    }
    if (options.prepend) {
      $notifications.prepend($el);
    } else {
      $notifications.append($el);
    }
    //$notifications[0].scrollTop = $notifications[0].scrollHeight;
  }

  // Prevents input from having injected markup
  const cleanInput = (input) => {
    return $('<div/>').text(input).html();
  }

  // Updates the typing event
  const updateTyping = () => {
    if (connected) {
      if (!typing) {
        typing = true;
        socket.emit('typing');
      }
      lastTypingTime = (new Date()).getTime();

      setTimeout(() => {
        var typingTimer = (new Date()).getTime();
        var timeDiff = typingTimer - lastTypingTime;
        if (timeDiff >= TYPING_TIMER_LENGTH && typing) {
          socket.emit('stop typing');
          typing = false;
        }
      }, TYPING_TIMER_LENGTH);
    }
  }

  // Gets the 'X is typing' messages of a user
  const getTypingMessages = (data) => {
    return $('.typing.message').filter(function (i) {
      return $(this).data('username') === data.username;
    });
  }

  // Gets the color of a username through our hash function
  const getUsernameColor = (username) => {
    // Compute hash code
    var hash = 7;
    for (var i = 0; i < username.length; i++) {
       hash = username.charCodeAt(i) + (hash << 5) - hash;
    }
    // Calculate color
    var index = Math.abs(hash % COLORS.length);
    return COLORS[index];
  }

  const updateAspects = (stats) => {
    console.log(stats);
    for(i=0;i<ASPECT_NAMES.length;i++)
    {
      aspect = ASPECT_NAMES[i];
      //console.log(aspect); console.log(stats[aspect]);
      myEmpire.aspects[aspect].level = stats[aspect][0];
      myEmpire.aspects[aspect].quantity = stats[aspect][1];
      $('#'+aspect+'_lvl').text(" " + myEmpire.aspects[aspect].level);
      $('#'+aspect+'_progressbar')
        .css('width', '' + (myEmpire.aspects[aspect].quantity/MAX_RESOURCE_QUANTITY*100) + '%')
        .html(numberWithCommas(myEmpire.aspects[aspect].quantity)+'/'+numberWithCommas(MAX_RESOURCE_QUANTITY));
    }

  }

  // Keyboard events

  $window.keydown(event => {
    // Auto-focus the current input when a key is typed
    if (!(event.ctrlKey || event.metaKey || event.altKey)) {
      $currentInput.focus();
    }
    // When the client hits ENTER on their keyboard
    if (event.which === 13) {
      if (username) {
        sendMessage();
        socket.emit('stop typing');
        typing = false;
      } else {
        setUsername();
      }
    }
  });

  $inputMessage.on('input', () => {
    updateTyping();
  });

  // Click events

  // Focus input when clicking anywhere on login page
  $loginPage.click(() => {
    $currentInput.focus();
  });

  // Focus input when clicking on the message input's border
  $inputMessage.click(() => {
    $inputMessage.focus();
  });

  // Socket events

  // Whenever the server emits 'login', log the login message
  socket.on('login', (data) => {
    connected = true;
    // Display the welcome message
    var message = "<#> Welcome to HexWorld <#>";
    log(message, {
      prepend: true
    });
    addParticipantsMessage(data);

	});

  socket.on('login failed', () => {
    connected = false;
    $chatPage.hide();
    $chatPage.off('click');
    $loginPage.fadeIn();
    $loginPage.on('click');
    username = "";
    $currentInput = $usernameInput.focus();
    $('#loginerror').removeAttr("hidden");
  });

  // Whenever the server emits 'new message', update the chat body
  socket.on('new message', (data) => {
    if(!silentMode && !quietMode) addChatMessage(data);
  });

  socket.on('notifications', (data) => {
    console.log(data);
    addNotificationsMessage(data);
  });

  socket.on('silent', (data) => {
    silentMode = true;
    addNotificationsMessage(data)
  });

  socket.on('quiet', (data) => {
    quietMode = true;
    addNotificationsMessage(data)
  });

  socket.on('listen', (data) => {
    silentMode = false;
    quietMode = false;
    addNotificationsMessage(data);
  });

  socket.on('whisper', (data) => {
    if(!silentMode) addChatMessage(data);
  });

  socket.on('block', (data) => {
    if(!arrayContains(data.blockUser,blockList)) blockList.push(data.blockUser);
    addNotificationsMessage(data);
  });

  socket.on('unblock', (data) => {
    if(arrayContains(data.blockUser,blockList)) blockList.pop(data.blockUser);
    addNotificationsMessage(data);
  });

  socket.on('adminmsg', (data) => {
    addNotificationsMessage(data);
  });

  // Whenever the server emits 'user joined', log it in the chat body
  socket.on('user joined', (data) => {
    log(data.username + ' joined');
    addParticipantsMessage(data);
  });

  // Whenever the server emits 'user left', log it in the chat body
  socket.on('user left', (data) => {
    log(data.username + ' left');
    addParticipantsMessage(data);
    removeChatTyping(data);
  });

  // Whenever the server emits 'typing', show the typing message
  socket.on('typing', (data) => {
    addChatTyping(data);
  });

  // Whenever the server emits 'stop typing', kill the typing message
  socket.on('stop typing', (data) => {
    removeChatTyping(data);
  });

  socket.on('disconnect', () => {
    log('you have been disconnected');
  });

  socket.on('forceDisconnect', function(){
    log('you have been kicked from the server by admin');
    socket.disconnect();
  });

  socket.on('reconnect', () => {
    log('you have been reconnected');
    if (username) {
      socket.emit('add user', username);
    }
  });

  socket.on('reconnect_error', () => {
    log('attempt to reconnect has failed');
  });

   socket.on('update', function (users){
        userList = users;
        $('#users').empty();
        for(var i=0; i<userList.length; i++) {
    			if(userList[i].username == username) {
    				var row = '';
    				row += '<tr class="leaderboard-user-row">';
            row += '<td>'+userList[i].age+'</td>';
    				row += '<td>'+userList[i].level+'</td>';
    				row += '<td>'+userList[i].territory+'</td>';
    				row += '<td>'+userList[i].username+'</td>';
    				row += '</tr>';
    				$('#users').append(row);

    			}
        }
		for(var i=0; i<userList.length; i++) {
			if(userList[i].username != username) {
				var row = '';
				row += '<tr>';
        row += '<td>'+userList[i].age+'</td>';
				row += '<td>'+userList[i].level+'</td>';
				row += '<td>'+userList[i].territory+'</td>';
				row += '<td>'+userList[i].username+'</td>';
				row += '</tr>';
				$('#users').append(row);
			   }
        }
        $('#users > tr').click(
            function(){
              addToInput($(this).children('td')[3].innerHTML+' ');
              console.log($(this).children('td'));
            }
        );
    });

    socket.on('update empire', (stats) => {
      updateAspects(stats);
    });


    function arrayContains(needle, arrhaystack)
    {
        return (arrhaystack.indexOf(needle) > -1);
    }

    function capitalizeFirstLetter(string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }

    function numberWithCommas(x) {
      return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    }

    function addActionDiv(name,primary,secondary)
    {
      str = '<div id="action_div1">' +
            '<div class="row content action-n-icon">' +
            '<div class="col-md-5">' +
            '<img src="img/'+name+'_icon.png" width="100" style="padding:20px;" /></div>' +
            '<div class="col-md-7">'+capitalizeFirstLetter(name)+' <span class="action-level-label" id="'+name+'_lvl"></span>' +
            '<button type="button" class="btn btn-primary action-btn" id="'+name+'_primary">Primary</button>' +
            '<button type="button" class="btn btn-primary action-btn" id="'+name+'_secondary">Secondary</button>' +
            '</div></div><div class="progress">' +
            '<div id="'+name+'_progressbar" class="progress-bar" role="progressbar" style="width: 0%;" >0/'+numberWithCommas(MAX_RESOURCE_QUANTITY)+'</div>' +
            '</div></div>';
        $('#actions').append(str);
        $('#'+name+'_primary').click(function(){addToInput('#'+primary+' ')});
        $('#'+name+'_secondary').click(function(){addToInput('#'+secondary+' ')});
    }

    function addToInput(msg)
    {
      $('#input').val($('#input').val() + msg);
      $currentInput.focus();
    }

    addActionDiv('army','trai','figh');
    addActionDiv('science','rese','disc');
    addActionDiv('production','prod','trad');
    addActionDiv('diplomacy','nego','trea');
    addActionDiv('growth','gove','conq');
    addActionDiv('development','inve','buil');

// end of file - DO NOT REMOVE!
});
