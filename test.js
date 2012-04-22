
APE.Client.prototype.on=function($event,func){this.addEvent("on_"+$event,func);}
APE.PubSub={user:{},opts:{},channels:{},eventQueue:{},globalEventQueue:[],client:{},debug:true,session:false,state:0,reconnect:0,restoring:false,startOpt:{}};APE.PubSub.load=function(callback){var $this=this;if(typeof callback!="function")
callback=function(){};if(this.isReady){callback();return false;}
APE.Config.scripts=[];if(this.debug){(function(){for(var i=0;i<arguments.length;i++)
APE.Config.scripts.push(APE.Config.baseUrl+'/Source/'+arguments[i]+'.js');})('mootools-core','Core/APE','Core/Events','Core/Core','Pipe/Pipe','Pipe/PipeProxy','Pipe/PipeMulti','Pipe/PipeSingle','Request/Request','Request/Request.Stack','Request/Request.CycledStack','Transport/Transport.longPolling','Transport/Transport.SSE','Transport/Transport.XHRStreaming','Transport/Transport.JSONP','Core/Utility','Core/JSON');if(this.session)APE.Config.scripts.push(APE.Config.baseUrl+"/Source/Core/Session.js");}else{if(this.session){APE.Config.scripts.push(APE.Config.baseUrl+"/Build/yuiCompressor/apeCoreSession.js");}else{APE.Config.scripts.push(APE.Config.baseUrl+"/Build/yuiCompressor/apeCore.js");}}
var client=new APE.Client();for(var name in this.globalEventQueue){var stack=this.globalEventQueue[name];for(var i in stack){client.addEvent(name,stack[i]);}}
client.addEvent("onRaw",function(res,channel){APE.debug(">>>>"+res.raw+"<<<<");});client.addEvent("onCmd",function(cmd,data){APE.debug("<<<<"+cmd+">>>>");});client.onRaw("ERR",function(raw){APE.debug("Error: ["+raw.data.code+"] "+raw.data.value);});client.addEvent("apeReconnect",function(){APE.debug("><><><><>Reconecting<><><><><");});client.addEvent("apeDisconnect",function(){APE.debug("Lost Connection to Server");});client.on("reconnect",function(){APE.debug("|Reconnecting======("+$this.reconnect+")===========>");});client.onError("004",function(){$this.isReady=false;$this.reconnect++;if($this.reconnect>3){APE.debug("Could not reconnect to APE server");client.fireEvent("apeDisconnect");client.fireEvent("on_disconnec");client.core.clearSession();return;}
APE.debug("BAD SESSION");APE.debug("Reconnecting to server");client.fireEvent("on_reconnect");this.core.removeInstance(this.core.options.identifier);this.core.saveCookie();this.core.stopPoller();this.core.cancelRequest();client.load();});client.onRaw("CHANNEL",function(res,pipe){var chanName=pipe.name;APE.debug("Joined channel"+"["+chanName+"]");APE.debug("Updating user properties from channel");for(var name in $this.client.core.user.properties){$this.user[name]=$this.client.core.user.properties[name];}
pipe.on=function($event,action){$event="on_"+$event;this.addEvent($event,action);APE.debug("Adding event '"+$event+"' to ["+chanName+"]");}
if($this.eventQueue[chanName]){for(var $event in $this.eventQueue[chanName]){for(var i in $this.eventQueue[chanName][$event]){pipe.addEvent($event,$this.eventQueue[chanName][$event][i]);APE.debug("Adding event '"+$event+"' to ["+chanName+"]");}}}
$this.channels[chanName]=pipe;pipe.fireEvent("on_callback");});client.onRaw("PUBDATA",function(raw,pipe){var data=raw.data;if(data.type=="message")
data.content=unescape(data.content);pipe.fireGlobalEvent("on_"+data.type,[data.content,data.from,pipe]);return this;});client.onRaw("LEFT",function(res,pipe){pipe.properties=res.data.pipe.properties;var user=res.data.user.properties||{};user.pubid=res.data.user.pubid;pipe.fireGlobalEvent("on_"+res.raw.toLowerCase(),[user,pipe]);});client.onRaw("JOIN",function(res,pipe){pipe.properties=res.data.pipe.properties;var user=res.data.user.properties||{};user.pubid=res.data.user.pubid;pipe.fireGlobalEvent("on_"+res.raw.toLowerCase(),[user,pipe]);});client.addEvent("restoreStart",function(){APE.debug("Restoring Session...");this.restoring=true;});client.addEvent("restoreEnd",function(){APE.debug("Session Restored");this.restoring=false;client.fireEvent("ready");});client.addEvent('load',function(){APE.debug("Starting APE core");this.core.options.channel=$this.startOpt.channel||null;client.core.$events["error_004"].splice(0,1);if($this.session&&client.core.options.restore){client.core.start(null,$this.starOpt);}else{client.core.start({user:$this.user,opts:$this.opts},$this.starOpt);}});client.addEvent('ready',function(){if(this.restoring)return this
$this.isReady=true;$this.reconnect=0;APE.debug('Your client is now connected');callback();client.fireEvent("on_connected");})
client.load();this.client=client;return this;}
APE.PubSub.fn={Sub:function(chanName,Events,callback){if(typeof chanName=="object"&&!this.isReady){var $args=arguments;var $this=this;this.load(function(){Sub.apply($this,$args);})
return this;}
if(typeof Events=="object"){onChan(chanName,Events);}
if(typeof callback=="function"){onChan(chanName,"callback",callback);}
this.startOpt.channel=this.startOpt.channel||[];this.startOpt.channel.push(chanName);if(this.isReady){this.client.core.join(chanName);}else{this.load();}
return this;},unSub:function(channel){APE.debug(channel);if(channel=="")return;getChan(channel).left();delete APE.PubSub.channels[channel];APE.debug("Unsubscribed from ("+channel+")");},Pub:function(channel,data){if(!channel){APE.debug("NOT IN A CHANNEL",true);return;};APE.debug("Sending \""+data+"\" through ["+channel+"]");var cmd={type:getChan(channel).type};cmd.data=data;getChan(channel).request.send("PUB",cmd);},getChan:function(channel){if(typeof this.channels[channel]=="object"){return this.channels[channel];}
return false;},onChan:function(chanName,Events,action){if(typeof Events=="object"){if(typeof this.eventQueue[chanName]!="object")
this.eventQueue[chanName]={};for(var $event in Events){var action=Events[$event];$event="on_"+$event;if(typeof this.eventQueue[chanName][$event]!="array")
this.eventQueue[chanName][$event]=[];this.eventQueue[chanName][$event].push(action);APE.debug("Adding ["+chanName+"] event '"+$event+"' to queue");}}else{var xnew=Object();xnew[Events]=action;onChan(chanName,xnew);};},onAllChan:function(Events,action){if(typeof Events=="object"){for(var $event in Events){var action=Events[$event];$event="on_"+$event;if(this.client instanceof APE.Client){APE.debug("Ape client is ready")
this.client.addEvent($event,action)
continue;}
if(typeof this.globalEventQueue[$event]!="array")
this.globalEventQueue[$event]=[];this.globalEventQueue[$event].push(action);APE.debug("Adding Global event '"+$event+"' to queue");}}else{var xnew={};xnew[Events]=action;onAllChan(xnew);};},APE_ready:function(callback){this.load(callback)}};for(func in APE.PubSub.fn){window[func]=APE.PubSub.fn[func].bind(APE.PubSub);}
delete func;APE.debug=function($obj){if(!this.PubSub.debug)return;var pre="[APE] ";if(typeof $obj=="string"){window.console.log(pre+$obj);}else{window.console.log(pre+"[Object]");window.console.log($obj);}};function randomString(l){var chars="0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz";var string_length=l;var randomstring='';for(var i=0;i<string_length;i++){var rnum=Math.floor(Math.random()*chars.length);randomstring+=chars.substring(rnum,rnum+1);}
return randomstring;}