$(document).ready(function(){
	//Create a new APS client
	var client = new APS(ServerDomain);
	
	//Makes the client object global for debugging
	if(EnableDebug)
		window.client = client;


	//Enable debug output to browser console
	client.option.debug = EnableDebug;
	client.option.session = EnableSession;
	
	/*
	 * Add global events which will apply to all channels 
	 * including existing and future ones
	 */
	client.on({
		
		join: function(user, channel){
			newUser(user)
		},
		
		left: function(user, channel){
			$("#u-" + user.name).slideUp("fast", function(){
				$(this).remove();
				$("#c-"+user.name+" .feed-body").append("<h4>...user offline...</h4>");
				$("#c-"+user.name+" .feed-send input").prop("disabled", true);
			})
		},
		error007: function(){
			$("<div>").addClass("alert alert-warning")
				.html("The user name <b>" + this.user.name + "</b> is not available.")
				.appendTo("#userPicker .errorTray");
		},
		
		error006: function(){
			$("<div>").addClass("alert alert-warning")
				.html("The user name <b>" + this.user.name + "</b> is not a valid name. It must be alphanumeric.")
				.appendTo("#userPicker .errorTray");
		},
		
		ready: function(){
			$("#userPicker").hide();

			newUser(this.user)
				.addClass("current").prependTo($("#userList"));
			
			this.user.on("message", function(message, from, channel){
				newLine(message, from, from);
			});
				
		}
		
	});
	
	client.onChannel("userLobby", "joined", function(){
		for(var id in this.users){
			//skip current user
			if(client.user.pubid == id) continue;
			newUser(this.users[id]);
		}
	})
	
	var newUser = function(user){
		var container = $("#userList");
		var row = $("<div>");
		
		row.prop("id", "u-" + user.name)
		row.addClass("user row");
		
		$("<img>").addClass("user-avatar")
			.prop("src", "http://www.gravatar.com/avatar/" + user.avatar + "?d=identicon&s=20")
			.appendTo(row)
		
		$("<strong>").text(user.name)
			.addClass("user-name")
			.appendTo(row);
		//.glyphicon .glyphicon-edit
		$("<button>").text("chat ")
			.addClass("chatWithUser btn btn-default btn-xs")
			.data("pubid", user.pubid)
			.append("<span class=\"glyphicon glyphicon-edit\"></span>")
			.appendTo(row);
			
		container.append(row);

		return row;
	}
	
	var newChat = function(data, line){
		var chat = $("#chatTemplate").clone();
		var list = $("#chatList");
		
		chat.prop("id", "c-"+data.name);
		chat.find(".name").text(data.name);
		chat.find(".feed-send").data("pubid", data.pubid);
		chat.find(".user-avatar").prop("src", "http://www.gravatar.com/avatar/" + data.avatar + "?d=identicon&s=20");
		
		if(typeof line != "undefine")
			chat.find(".feed-body").append(line).trigger("newLine");
		
		list.prepend(chat);
		chat.find("input:first").prop("disabled", false).focus();
	}
	
	var newLine = function(message, from, to){
		
		//Use "Me" as the name if the message is from the current user
		if(client.user.pubid == from.pubid){
			from = client.user;
			from.name = "Me";
		}
		
		var line = "<div>";
		line += "<img class='user-avatar' src='http://www.gravatar.com/avatar/" + from.avatar + "?d=identicon&s=20'>";
		line += "<b>"+from.name+":</b> "+message;
		
		if($("#c-"+to.name).length == 0){
			newChat(to, line);
		}else{
			$("#c-"+to.name+" .feed-body")
				.append(line)
				.trigger("newLine");
		}
	}
	
	$("#userPicker input[name='username']").val("User_"+randomString(5));
	
	$("#userPicker").on("submit", function(e){
		e.preventDefault();
		
		client.user = {
			name: $(this).find("input[name='username']").val(),
			avatar: randomString(32, "0123456789ABCDEF").toLowerCase()
		}
		
		$(this).find(".errorTray").empty();
		
		client.sub("userLobby");
	});
	
	$("#userList").on("click", ".chatWithUser", function(){
		var user = client.getPipe($(this).data("pubid"));
		
		if(user){
			var chat = $("#chatList").find("#c-" + user.name);
			
			if(chat.length == 0){
				newChat(user);
			}else{
				window.location.hash = "c-" + user.name;
				chat.find("[name='message']").focus();
			}
		}
	});
	
	$("#chatList").on("submit", ".feed-send", function(e){
		e.preventDefault();
		
		var formInput = $(this).find("[name='message']");
		var pubid = $(this).data("pubid");

		//Get the user object - the recipient
		var recipient = client.getPipe(pubid);
		
		recipient.pub(formInput.val());
		
		newLine(formInput.val(), client.user, recipient);
		
		//Clear input and focus
		formInput.val("").focus();
		
		return false;
	});
	
	$("#chatList").on("click", "button.close", function(e){
		$(this).parents(".panel").first().parent().slideUp("fast", function(){
			$(this).remove();
		});
	});
	
	/*
	 * Animate feed on new line message
	 */
	$("#chatList").on("newLine", ".feed-body", function(){
		$this = $(this);
		
		$this.animate({scrollTop: $this.prop("scrollHeight") - $this.height()},{
			queue: true	
		});
	});
	
})
