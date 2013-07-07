/*
 * Prototype in the session object
 * The object current multiple cookies
 * handlers to save session related data
 * as well as other persistent information
 * require by the framework.
 * 
 * The session object currently uses cookies
 * to store the required information but in
 * the future i would like to implement the
 * SessionStorage API with a fallback to 
 * cookies.
 */
APS.prototype.session = {
	id: "",
	chl: {},
	_client: {},
	cookie: {},
	freq: {},
	data: {},
	
	save: function(){
		if(!this._client.option.session) return;
		
		var pubid = this._client.user.pubid;
		
		this.cookie.change(this.id + ":" + pubid);
		this.saveChl();
	},
	 
	saveChl: function(){
		if(!this._client.option.session) return;
		
		this._client.chl++;
		this.chl.change(this._client.chl);
	},
	
	destroy: function(Keepfreq){
		if(!this._client.option.session) return;
		
		this.cookie.destroy();
		this.chl.destroy();
		if(!!!Keepfreq)
			this.freq.change(0);
		this._client.chl = 0;
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
		var client = this._client;
		
		//Load cookies
		this.chl = new APS.cookie(client.identifier + "_chl");
		this.cookie = new APS.cookie(client.identifier + "_session");
		this.freq = new APS.cookie(client.identifier + "_frequency");
		
		client.chl = this.chl.value || 0;
		
		//Initial frequency value
		if(!this.freq.value) this.freq.change("0");
		
		if(typeof this.cookie.value == "string" && this.cookie.value.length >= 32){
			var data = this.cookie.value.split(":");
			this.id = data[0];
		}else{
			return false;
		}
		
		//Restoring session state == 2
		client.state = 2;
		return {sid: data[0], pubid: data[1]};
	}
}

/*
 * the cookie object constructor
 */
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
		this.value = value;
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
		this.value = value || "";
		this.change(this.value, days);
	}
	return this;
}