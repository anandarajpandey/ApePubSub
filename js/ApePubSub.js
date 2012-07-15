/**
 * @author Pablo Tejada
 * Built on 2012-07-15 @ 02:42
 */

//Generate a random string
function randomString(l){
	var chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz";
	var string_length = l;
	var randomstring = '';
	for (var i=0; i<string_length; i++) {
		var rnum = Math.floor(Math.random() * chars.length);
		randomstring += chars.substring(rnum,rnum+1);
	}
	return randomstring;
}

// Official bind polyfill at developer.mozilla.org
if(!Function.prototype.bind){
	Function.prototype.bind = function(oThis){
	if(typeof this !== "function"){
		// closest thing possible to the ECMAScript 5 internal IsCallable function
		throw new TypeError("Function.prototype.bind - what is trying to be bound is not callable");
	}

	var aArgs = Array.prototype.slice.call(arguments, 1), 
		fToBind = this, 
		fNOP = function(){},
		fBound = function(){
			return fToBind.apply(this instanceof fNOP
								 ? this
								 : oThis || window,
								 aArgs.concat(Array.prototype.slice.call(arguments)));
		};

	fNOP.prototype = this.prototype;
	fBound.prototype = new fNOP();

	return fBound;
	};
}

function APS( server, events, options ){
	this.option = {
		'poll': 25000,
		debug: true,
		session: true,
		connectionArgs: {},
		server: server
	}
	this.identifier = "APS";
	this.version = 'draft-v2';
	this.state = 0;
	this.events = {};
	this.chl = 0;
	this.user = {};
	this.pipes = {};
	this.channels = {};
	this.eQueue = {};
	
	//Add Events
	this.on(events);

	var cb = {
		'onmessage': this.onMessage.bind(this),
		'onerror': function(err){
			console.log("ERROR >> ",err);
		}
	}

	this.connect = function(args){
		var client = this;
		this.option.connectionArgs = args || this.option.connectionArgs;
		
		server = server || APS.server;
		if(this.state == 0)
			this.transport = new APS.transport(server, cb, options);
		
		//alert("connnecting...")
		
		//Handle sessions
		if(this.option.session == true){
			if(this.session.restore() == true) return this;
		}
		
		this.sendCmd('CONNECT', args);
		
		return this;
	}
	
	this.session.client = this;
	return this;
}

APS.prototype.trigger = function(ev, args){
	ev = ev.toLowerCase();
	
	if(!(args instanceof Array)) args = [args];
	
	//GLobal
	if("client" in this){
		for(var i in this.client.events[ev]){
			if(this.client.events[ev].hasOwnProperty(i)){ 
				this.client.events[ev][i].apply(this, args);
				this.log("{{{ " + ev + " }}} on client ", this.client);
			}
		}
	}
	
	//Local
	for(var i in this.events[ev]){
		if(this.events[ev].hasOwnProperty(i)){
			this.events[ev][i].apply(this, args);
			if(!this.client){
				this.log("{{{ " + ev + " }}} on client ", this);
			}else{
				this.log("{{{ " + ev + " }}} ", this);
			}
		}
	}
}

APS.prototype.on = function(ev, fn){
	var Events = [];
	
	if(typeof ev == 'string' && typeof fn == 'function'){
		Events[ev] = fn;
	}else if(typeof ev == "object"){
		Events = ev;
	}else{
		return this;
	}
	
	for(var e in Events){
		var fn = Events[e];
		if(!this.events[e])
			this.events[e] = [];
		this.events[e].push(fn);
	}
	
	return this;
}

APS.prototype.getPipe = function(user){
	if(typeof user == 'string'){
		return this.pipes[user];
	} else {
		return this.pipes[user.pubid];
	}
}

APS.prototype.send =function(pipe, $event, data, callback){
	this.sendCmd("Event", {
		event: $event,
		data: data
	}, pipe, callback);
}

APS.prototype.sendCmd = function(cmd, args, pipe, callback){
	var specialCmd = {CONNECT: 0, RESTORE:0};
	if(this.state == 1 || cmd in specialCmd){

		var tmp = {
			'cmd': cmd,
			'chl': this.chl
		}

		if(args) tmp.params = args;
		if(pipe) tmp.params.pipe = typeof pipe == 'string' ? pipe : pipe.pubid;
		if(this.session.id) tmp.sessid = this.session.id;

		this.log('<<<< ', cmd.toUpperCase() , " >>>> ", tmp);
		
		if(typeof callback != "function")	callback = function(){};
		
		var data = [];
		try { 
			data = JSON.stringify([tmp]);
		}catch(e){
			this.log(e);
			this.log(data);
		}
		
		this.transport.send(data, callback);
		if(!(cmd in specialCmd)){
			clearTimeout(this.poller);
			this.poll();
		}
		this.chl++;
		this.session.saveChl();
	} else {
		this.on('ready', this.sendCmd.bind(this, cmd, args));
	}
	
	return this;
}

APS.prototype.poll = function(){
	if(this.transport.id == 0)
		this.poller = setTimeout((function(){ this.check() }).bind(this), this.option.poll);
}

APS.prototype.check = function(){
	if(this.transport.id == 0)
		this.sendCmd('CHECK');
}

APS.prototype.sub = function(channel, Events, callback){
	//Handle the events
	if(typeof Events == "object"){
		if(typeof channel == "object"){
			for(var chan in channel){
				this.onChannel(channel[chan], Events);
			}
		}else{
			this.onChannel(channel, Events);
		}
	}
	
	//Handle callback
	if(typeof callback == "function"){
		if(typeof channel == "object"){
			for(var chan in channel){
				this.onChannel(channel[chan], "joined", callback);
			}
		}else{
			this.onChannel(channel, "joined", callback);
		}
	}
	
	//Join Channel
	if(this.state == 0){
		this.on("ready", this.sub.bind(this, channel));
		this.connect({user: this.user});
		
	}else if(typeof this.channels[channel] != "object"){
		this.sendCmd('JOIN', {'channels': channel});
	}
	
	return this;
}

APS.prototype.pub = function(channel, data, callback){
	var pipe = this.getChannel(channel);
	if(!pipe && channel.length == 32) pipe = this.getPipe(channel);
	
	if(pipe){
		var $event = typeof data == "string" ? "message" : "data";
		var args = {data: data};
		pipe.send($event, data, callback);
		//pipe.trigger("pub",args);
	}else{
		this.log("NO Channel " + channel);
	}
};

APS.prototype.getChannel = function(channel){
	channel = channel.toLowerCase();
	if(channel in this.channels){
		return this.channels[channel];
	}
	
	return false;
}

APS.prototype.onChannel = function(channel, Events, fn){
	channel = channel.toLowerCase();
	
	if(channel in this.channels){
		this.channels[channel].on(Events, fn);
		return true;
	}
	
	if(typeof Events == "object"){
		//add events to queue
		if(typeof this.eQueue[channel] != "object")
			this.eQueue[channel] = [];
		
		//this.eQueue[channel].push(Events);
		for(var $event in Events){
			var fn = Events[$event];
			
			this.eQueue[channel].push([$event, fn]);
			
			this.log("Adding ["+channel+"] event '"+$event+"' to queue");
		}
	}else{
		var xnew = Object();
		xnew[Events] = fn;
		this.onChannel(channel,xnew);
	}
}

APS.prototype.unSub = function(channel){
	if(channel == "") return;
	this.getChannel(channel).leave();
}

//Debug Function for Browsers console
if(navigator.appName != "Microsoft Internet Explorer"){
	APS.prototype.log = function(){
		if(!this.debug) return;
		
		var args =  Array.prototype.slice.call(arguments);
		args.unshift("["+this.identifier+"]");
		
		window.console.log.apply(console, args);
	};
	
}else{
	APS.prototype.log = function(){
		if(!this.debug) return;
		
		var args =  Array.prototype.slice.call(arguments);
		args.unshift("["+this.identifier+"]");

		window.console.log(args.join().replace(",",""));
	}
}



APS.prototype.onMessage = function(data){
	//var data = data;
	try { 
		data = JSON.parse(data)
	}catch(e){
		this.trigger("dead", [e]);
		return clearTimeout(this.poller);
	}
	
	var cmd, args, pipe;
	var check = true;
	
	for(var i in data){
		cmd = data[i].raw;
		args = data[i].data;
		pipe = null;
		clearTimeout(this.poller);
		
		this.log('>>>> ', cmd , " <<<< ", args);

		switch(cmd){
			case 'LOGIN':
				check = false;
				
				this.state = this.state == 0 ? 1 : this.state;
				this.session.id = args.sessid;
				this.poll();
				this.session.save();
			break;
			case 'IDENT':
				check = false;
				
				var user = new APS.user(args.user, this);
				this.pipes[user.pubid] = user;
				
				user.events = {};
				user.client = this;
				user.on = this.on.bind(user);
				user.trigger = this.trigger.bind(user);
				user.log = APS.prototype.log.bind(this, "[user]");
				
				this.user = user;
				
				if(this.state == 1)
					this.trigger('ready');
				
				//this.poll(); //This call is under observation
			break;
			case 'RESTORED':
				check = true;
				//Session restored completed
				this.state = 1;
				this.trigger('ready');
			break;
			case 'CHANNEL':
				//this.log(pipe, args);
				pipe = new APS.channel(args.pipe, this);
				this.pipes[pipe.pubid] = pipe;
				this.channels[pipe.name] = pipe;
				
				var u = args.users;
				var user;
				
				//import users from channel to client
				for(var i = 0; i < u.length; i++){
					user = this.pipes[u[i].pubid]
					if(!user){
						user = new APS.user(u[i], this);
						this.pipes[user.pubid] = user;
					}
					
					user.channels[pipe.name] = pipe;
					pipe.users[user.pubid] = user;
					
					//Add user's own pipe to channels list
					user.channels[user.pubid] = user;

					//No Need to trigger this event
					//this.trigger('join', [user, pipe]);
				}
				
				//Add events from queue
				var chanName = pipe.name.toLowerCase();
				if(typeof this.eQueue[chanName] == "object"){
					var queue = this.eQueue[chanName];
					var ev, fn;
					for(var i in queue){
						ev = queue[i][0];
						fn = queue[i][1];
						
						pipe.on(ev,fn);
					}
				}
				
				pipe.trigger('joined',[this.user, pipe]);
				this.trigger('newChannel', [pipe]);
				
			break;
			case "EVENT":
				var user = this.pipes[args.from.pubid];
				pipe = this.pipes[args.pipe.pubid];
				
				if(pipe instanceof APS.user)
					pipe = this.user;
				
				pipe.trigger(args.event, [args.data, user, pipe]);
			break;
			case 'JOIN':
				var user = this.pipes[args.user.pubid];
				pipe = this.pipes[args.pipe.pubid];

				if(!user){
					user = new APS.user(args.user, this);
					this.pipes[user.pubid] = user;
				}
				
				//Add user's own pipe to channels list
				user.channels[pipe.pubid] = user;
				
				//Add user to channel list
				pipe.addUser(user);
				
				pipe.trigger('join', [user, pipe]);
			break;
			case 'LEFT':
				pipe = this.pipes[args.pipe.pubid];
				var user = this.pipes[args.user.pubid];
				
				delete user.channels[pipe.pubid];
				
				for(var i in user.channels){
					if(user.channels.hasOwnProperty(i)) delete this.pipes[user.pubid];
					break;
				}
				
				pipe.trigger('left', [user, pipe]);
			break;
			case 'NOSESSION':
				this.session.connect();
				
			break;
			case 'ERR' :
				check = false;
				switch(args.code){
					case "001":
					case "002":
					case "003":
						clearTimeout(this.poller);
						this.trigger("dead", args);
						break;
					case "004":
					case "250":
						this.state = 0;
						this.session.connect();
						break;
					default:
						this.check();
				}
				this.trigger("error",args);
				this.trigger("error"+args.code,args);
			break;
			default:
				//trigger custom commands
				this.trigger(cmd, args);
				//this.check();
		}
	}
	if(this.transport.id == 0 && check && this.transport.state == 1){
		this.check();
	}
}


//var APSTransport = function(server, callback, options){
APS.transport = function(server, callback, options){
	this.state = 0;//0 = Not initialized, 1 = Initialized and ready to exchange data, 2 = Request is running
	this.stack = [];
	this.callback = callback;
	
	//WS, SSE, long polling,
	
	if('WebSocket' in window && APS.wb == true){
		this.id = 6;
		var ws = new WebSocket('ws://' + server + '/6/');
		this.send = function(str){
			if(this.state > 0) ws.send(str);
			else this.stack.push(str);
		}.bind(this);

		ws.onopen = this.onLoad;

		ws.onmessage = function(ev){
			callback.onmessage(ev.data);
		}
		
		return;
	}
	
	this.id = 0;
	var frame = document.createElement('iframe');
	this.frame = frame;

	with(frame.style){ 
		position = 'absolute';
		left = top = '-10px';
		width = height = '1px';
	}

	frame.setAttribute('src', 'http://' + server + '/?[{"cmd":"frame","params": {"origin":"'+window.location.protocol+'//'+window.location.host+'"}}]');
	
	document.body.appendChild(frame);

	
	if('addEventListener' in window){
		window.addEventListener('message', this.frameMessage.bind(this), 0);
		frame.addEventListener('load', this.onLoad.bind(this), 0);
	} else {
		window.attachEvent('onmessage', this.frameMessage.bind(this));
	}
	
	var t = this;
	this.send = function(str, callback){
		if(this.state > 0){
			this.frame.contentWindow.postMessage(str, '*');
			this.state = 2;
		} else this.stack.push(str);
		
		if(typeof callback == "function") callback();
		//this.callback.once = callback || function(){};
	}
}

APS.transport.prototype.postMessage = function(str, callback){
	if(this.state > 0){
		this.frame.contentWindow.postMessage(str, '*');
		this.state = 2;
	} else this.stack.push(str);
	
	if(typeof callback == "function") callback();
	//this.callback.once = callback || function(){};
}
APS.transport.prototype.frameMessage = function(ev){
	this.state = 1;
	this.callback.onmessage(ev.data);
	//this.callback.once(ev.data);
	//this.callback.once = function(){};
}
APS.transport.prototype.onLoad = function(){
	if(this.id == 6) this.state = 2;
	else this.state = 1;

	for(var i = 0; i < this.stack.length; i++) this.send(this.stack[i]);
	this.stack = [];
}

//var APSUser = function(pipe, client) {
APS.user = function(pipe, client){
	for(var i in pipe.properties){
		this[i] = pipe.properties[i]
	}
	
	this.pubid = pipe.pubid;
	//this.client = client;
	this.channels = {};
	
	this.pub = APS.prototype.pub.bind(client, this.pubid);
	this.send = APS.prototype.send.bind(client, this.pubid);
	
	/*
	this.send = function(Event, data){
		client.sendCmd("Event", {
			event: Event,
			data: data
		}, this.pubid);
	}
	*/
}

//var APSChannel = function(pipe, client) {
APS.channel = function(pipe, client) {
	this.events = {};
	this.properties = pipe.properties;
	this.name = pipe.properties.name;
	this.pubid = pipe.pubid;
	this.client = client;
	this.users = {};
	
	this.addUser = function(u){
		this.users[u.pubid] = u;
	}
	
	/*
	this.send = function(Event, data){
		client.sendCmd("Event", {
			event: Event,
			data: data
		}, this.pubid);
	}
	*/
	
	this.leave = function(){
		this.trigger("unsub", [client.user, this]);
		
		client.sendCmd('LEFT', {"channel": this.name});
		
		this.log("Unsubscribed from ("+this.name+")");
		
		delete client.channels[this.name];
	}
	
	this.send = APS.prototype.send.bind(client, this.pubid);
	
	this.on = APS.prototype.on.bind(this);
	this.pub = APS.prototype.pub.bind(client, this.name);
	this.trigger = APS.prototype.trigger.bind(this);
	this.log = APS.prototype.log.bind(client, "[channel]", "["+this.name+"]");
	//this.log = APS.prototype.log.bind(client);
}


APS.prototype.session = {
	id: "",
	chl: {},
	client: {},
	cookie: {},
	data: {},
	
	save: function(){
		if(!this.client.option.session) return;
		
		var pubid = this.client.user.pubid;
		var client = this.client;
		
		var session = {
			channels: Object.keys(client.channels),
			id: this.id,
			pubid: pubid
		}
		
		this.cookie.change(this.id);
		this.saveChl()
		
		//client.sendCmd("saveSESSION", session);
	},
	
	saveChl: function(){
		if(!this.client.option.session) return;

		this.chl.change(this.client.chl);
	},
	
	destroy: function(){
		if(!this.client.option.session) return;
		
		this.cookie.destroy();
		this.chl.destroy();
		this.client.chl = 0;
		this.id = null;
		this.properties = {};
	},
	
	get: function(index){
		return this.data[index];
	},
	
	set: function(index, val){
		this.data[index] = val;
	},
	
	restore: function(){
		var client = this.client;
		
		//alert("restoring")
		this.chl = new APS.cookie(client.identifier + "_chl");
		this.cookie = new APS.cookie(client.identifier + "_session");
		
		
		client.chl = this.chl.value || 0;
		
		if(typeof this.cookie.value == "string"){
			this.id = this.cookie.value;
		}else{
			this.destroy();
			//alert("no session")
			return false;
		}
		
		client.chl++;
		//Restoring session state == 2
		client.state = 2;
		client.sendCmd('RESTORE', {sid: this.id})
		return true;
	},
	
	connect: function(){
		var client = this.client;
		var args = client.option.connectionArgs
		
		this.destroy();
		client.sendCmd('CONNECT', args);
	}
	
}

APS.cookie = function(name,value,days){
	this.change = function(value,days){
		var name = this.name;
		if(days){
			var date = new Date();
			date.setTime(date.getTime()+(days*24*60*60*1000));
			var expires = "; expires="+date.toGMTString();
		}else{
			var expires = "";
		}
		document.cookie = name+"="+value+expires+"; path="+this.path;
	}
	
	this.read = function(name){
		var nameEQ = name + "=";
		var ca = document.cookie.split(';');
		for(var i=0;i < ca.length;i++) {
			var c = ca[i];
			while (c.charAt(0)==' ') c = c.substring(1,c.length);
			if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length,c.length);
		}
		return null;
	}
	
	this.destroy = function(){
		this.change("", -1);
	}
	
	this.path = "/";
	var exists = this.read(name);
	
	this.name = name;
	
	if(exists && typeof value == "undefined"){
		this.value = exists;
	}else{
		this.value = value;
		this.change(this.value, days);
	}
	return this;
}

