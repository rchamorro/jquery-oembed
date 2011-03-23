/*!
 * jquery oembed plugin
 *
 * Copyright (c) 2009 Richard Chamorro
 * Licensed under the MIT license
 * 
 * Author: Richard Chamorro 
 */
 
(function ($, undefined) {
	$.fn.oembed = function (url, options, callback) {

		if (typeof options != "undefined")
			$.fn.oembed.settings = $.extend(true, $.fn.oembed.defaults, options);
		else
			$.fn.oembed.settings = $.fn.oembed.defaults;
			
		initializeProviders();			

		
		return this.each(function () {

			var container = $(this),
				resourceURL = (url != null) ? url : container.attr("href"),
				provider;

			if (!callback) callback = $.fn.oembed.defaultCallbackFunction;

			if (resourceURL != null) {
				provider = getOEmbedProvider(resourceURL);			

				if (provider != null) {
					provider.params = getNormalizedParams($.fn.oembed.settings[provider.name]) || {};
					provider.maxWidth = $.fn.oembed.settings.maxWidth;
					provider.maxHeight = $.fn.oembed.settings.maxHeight;					
					
					$.fn.oembed.embedCode(container, resourceURL, provider, callback);
				}

				return;
			}

			callback(container, null, provider);
		});
	};
	
	var activeProviders = [];

	// Plugin defaults
	$.fn.oembed.defaults = {
		maxWidth: null,
		maxHeight: null,		
		embedMethod: "replace",  	// "auto", "append", "fill"		
		defaultOEmbedProvider: "oohembed", 	// "oohembed", "embed.ly", "none"
		allowedProviders: null,
		disallowedProviders: null,
		customProviders: null,	// [ new OEmbedProvider("customprovider", ["customprovider\\.com/watch.+v=[\\w-]+&?"]) ]	
		wmode: null,
		greedy: true
	};

	$.fn.oembed.getRequestUrl = function (provider, externalUrl) {

		var url = provider.apiendpoint || getDefaultOEmbedProviderUrl($.fn.oembed.settings.defaultOEmbedProvider);

		if (url.indexOf("?") <= 0)
			url = url + "?";
		else
			url = url + "&";

		var qs = "";

		if (provider.maxWidth != null && provider.params["maxwidth"] == null)
			provider.params["maxwidth"] = provider.maxWidth;

		if (provider.maxHeight != null && provider.params["maxheight"] == null)
			provider.params["maxheight"] = provider.maxHeight;

		for (var i in provider.params) {
			// We don't want them to jack everything up by changing the callback parameter
			if (i == provider.callbackparameter)
				continue;

			// allows the options to be set to null, don't send null values to the server as parameters
			if (provider.params[i] != null)
				qs += "&" + escape(i) + "=" + provider.params[i];
		}

		var callbackparameter = provider.callbackparameter || "callback";
		
		url += "format=json&url=" + escape(externalUrl) +
					qs +
					"&" + callbackparameter + "=?";

		return url;
	};
	
	$.fn.oembed.embedCode = function (container, externalUrl, provider, callback) {

		var request = $.fn.oembed.getRequestUrl(provider, externalUrl);

		$.getJSON(request, function (data) {

			var oembed = $.extend({}, data);
			var type = oembed.type;

			switch (type) {
				case "photo":
					oembed.code = $.fn.oembed.getPhotoCode(externalUrl, data);
					break;
				case "video":
					oembed.code = $.fn.oembed.getVideoCode(externalUrl, data);
					break;
				case "rich":
					oembed.code = $.fn.oembed.getRichCode(externalUrl, data);
					break;
				default:
					oembed.code = $.fn.oembed.getGenericCode(externalUrl, data);
					break;
			}

			callback(container, oembed, provider);
		});
	};

	// Plugin options
	$.fn.oembed.settings = {};

	$.fn.oembed.insertCode = function (container, embedMethod, oembed) {
		if (oembed == null)
			return;
			
		switch (embedMethod) {
			case "auto":
				if (container.attr("href") != null) {
					$.fn.oembed.insertCode(container, "append", oembed);
				}
				else {
					$.fn.oembed.insertCode(container, "replace", oembed);
				};
				break;
			case "replace":
				container.replaceWith(oembed.code);
				break;
			case "fill":
				container.html(oembed.code);
				break;
			case "append":
				var oembedContainer = container.next();
				if (oembedContainer == null || !oembedContainer.hasClass("oembed-container")) {
					oembedContainer = container
						.after('<div class="oembed-container"></div>')
						.next(".oembed-container");
					if (oembed != null && oembed.provider_name != null)
						oembedContainer.toggleClass("oembed-container-" + oembed.provider_name);
				}
				oembedContainer.html(oembed.code);
				break;
		}
	};

	$.fn.oembed.getPhotoCode = function (url, data) {
		var alt = data.title ? data.title : '';
		alt += data.author_name ? ' - ' + data.author_name : '';
		alt += data.provider_name ? ' - ' + data.provider_name : '';
		var code = '<div><a href="' + url + '" target=\'_blank\'><img src="' + data.url + '" alt="' + alt + '"/></a></div>';
		if (data.html)
			code += "<div>" + data.html + "</div>";
		return code;
	};

	$.fn.oembed.getVideoCode = function (url, data) {
		var code = data.html;

		/*
		if (code != null && options.insertwmode == true && oembed.code.indexOf("wmode") < 0) {			
		code = code.replace("<embed ", "<param name=\"wmode\" value=\"transparent\"></param>\n<embed ");
		code = code.replace("<embed ", "<embed wmode=\"transparent\"");			
		}
		*/
		return code;
	};

	$.fn.oembed.getRichCode = function (url, data) {
		var code = data.html;
		return code;
	};

	$.fn.oembed.getGenericCode = function (url, data) {
		var title = (data.title != null) ? data.title : url,
			code = '<a href="' + url + '">' + title + '</a>';
		if (data.html)
			code += "<div>" + data.html + "</div>";
		return code;
	};

	$.fn.oembed.isAvailable = function (url) {
		var provider = getOEmbedProvider(url);
		return (provider != null);
	};

	/* Private Methods */
	function getOEmbedProvider(url) {
		for (var i = 0; i < activeProviders.length; i++) {			
			if (activeProviders[i].matches(url))
				return activeProviders[i];
		}
		return null;
	}
	
	function initializeProviders(allowedProviders, disallowedProviders, customProviders) {

		activeProviders = [];
		
		if (!isNullOrEmpty($.fn.oembed.settings.allowedProviders)) {
			for(i = 0; i < providers.length; i++) {
				if ($.inArray(providers[i].name, $.fn.oembed.settings.allowedProviders) >= 0)				
					activeProviders.push(providers[i]);
			}
			// If there are allowed providers, jquery-oembed cannot be greedy
			$.fn.oembed.settings.greedy = false;
			
		} else {
			activeProviders = providers;
		}
		
		if (!isNullOrEmpty($.fn.oembed.settings.disallowedProviders)) {
			var restrictedProviders = [];			
			for(i = 0; i < activeProviders.length; i++) {
				if ($.inArray(activeProviders[i].name, $.fn.oembed.settings.disallowedProviders) < 0)				
					restrictedProviders.push(activeProviders[i]);				
			}			
			activeProviders = restrictedProviders;
			
			// If there are allowed providers, jquery-oembed cannot be greedy
			$.fn.oembed.settings.greedy = false;
		}		
		
		if (!isNullOrEmpty($.fn.oembed.settings.customProviders)) {			
			$.each($.fn.oembed.settings.customProviders, function(i, customProvider){				
				if (customProvider instanceof OEmbedProvider) {
					activeProviders.push(provider);
				} else {
					provider = new OEmbedProvider();
					if (provider.fromJSON(customProvider))
						activeProviders.push(provider);
				}				
			});			
		}	

		// If in greedy mode, we create
		if ($.fn.oembed.settings.greedy == true) {
			var defaultProvider = new OEmbedProvider($.fn.oembed.settings.defaultOEmbedProvider, null, getDefaultOEmbedProviderUrl($.fn.oembed.settings.defaultOEmbedProvider), "callback");
			activeProviders.push(defaultProvider);
		}		
	}

	$.fn.oembed.defaultCallbackFunction = function (container, oembed) {
		$.fn.oembed.insertCode(container, $.fn.oembed.settings.embedMethod, oembed);
	}

	function getDefaultOEmbedProvider(defaultOEmbedProvider) {
		return new OEmbedProvider(defaultOEmbedProvider, null, getDefaultOEmbedProviderUrl(defaultOEmbedProvider), "callback");
	}

	function getDefaultOEmbedProviderUrl(defaultOEmbedProvider) {
		if (defaultOEmbedProvider == "none")
			return null;
		if (defaultOEmbedProvider == "embed.ly")
			return "http://api.embed.ly/v1/api/oembed?";
		return "http://oohembed.com/oohembed/";
	}


	function getNormalizedParams(params) {
		if (params == null)
			return null;
		var normalizedParams = {};
		for (var key in params) {
			if (key != null)
				normalizedParams[key.toLowerCase()] = params[key];
		}
		return normalizedParams;
	}

	function isNullOrEmpty(object) {
		if (typeof object == "undefined")
			return true;
		if (object == null)
			return true;
		if ($.isArray(object) && object.length == 0)
			return true;
		return false;
	}

	var providers = [
		new OEmbedProvider("youtube", ["youtube\\.com/watch.+v=[\\w-]+&?"]),
		new OEmbedProvider("flickr", ["flickr\\.com/photos/[-.\\w@]+/\\d+/?"], "http://flickr.com/services/oembed", "jsoncallback"),
		new OEmbedProvider("slideshare", ["slideshare\.net"], "http://www.slideshare.net/api/oembed/1"),
		new OEmbedProvider("scribd", ["scribd\\.com/.+"], "http://www.scribd.com/services/oembed"),
		new OEmbedProvider("vimeo", ["http:\/\/www\.vimeo\.com\/groups\/.*\/videos\/.*", "http:\/\/www\.vimeo\.com\/.*", "http:\/\/vimeo\.com\/groups\/.*\/videos\/.*", "http:\/\/vimeo\.com\/.*"], "http://vimeo.com/api/oembed.json"),
		new OEmbedProvider("vids.myspace.com", ["vids\.myspace\.com"], "http://vids.myspace.com/index.cfm?fuseaction=oembed"),
		new OEmbedProvider("photobucket", ["photobucket\\.com/(albums|groups)/.*"], "http://photobucket.com/oembed/"),
		new OEmbedProvider("screenr", ["screenr\.com"], "http://screenr.com/api/oembed.json"),
		new OEmbedProvider("blip", ["blip\\.tv/.+"], "http://blip.tv/oembed/"),
		new OEmbedProvider("dailymotion", ["dailymotion\\.com/.+"], "http://www.dailymotion.com/api/oembed/"),
		new OEmbedProvider("googlevideo", ["video\.google\."]),
		new OEmbedProvider("wikipedia", ["http:\/\/wikipedia\.org\/wiki\/.*"]),
		new OEmbedProvider("fivemin", ["http://www.5min.com/video/*"]),
		new OEmbedProvider("amazon", ["amazon\.com"]),
		new OEmbedProvider("hulu", ["hulu\\.com/watch/.*"]),
		new OEmbedProvider("imdb", ["imdb\.com"]),
		new OEmbedProvider("metacafe", ["metacafe\.com"]),
		new OEmbedProvider("qik", ["qik\\.com/\\w+"]),
		new OEmbedProvider("revision3", ["revision3\.com"]),
		new OEmbedProvider("twitpic", ["twitpic\.com"]),
		new OEmbedProvider("viddler", ["viddler\.com"]),
		new OEmbedProvider("wordpress", ["wordpress\.com"])

	];


	function OEmbedProvider(name, urlschemes, apiendpoint, callbackparameter) {
		this.name = name;
		this.urlschemes = getUrlSchemes(urlschemes);
		this.apiendpoint = apiendpoint;
		this.callbackparameter = callbackparameter;
		this.maxWidth = 500;
		this.maxHeight = 400;

		this.matches = function (externalUrl) {
			for (var i = 0; i < this.urlschemes.length; i++) {
				var regExp = new RegExp(this.urlschemes[i], "i");
				if (externalUrl.match(regExp) != null)
					return true;
			}
			return false;
		};
		
		this.fromJSON = function(json) {
			for(var property in json){
				if (property != "urlschemes")				
	        		this[property] = json[property];
				else
					this[property] = getUrlSchemes(json[property])
    		}		
			return true; 	
		};
		
		function getUrlSchemes(urls) {
			if (isNullOrEmpty(urls))
				return ["*"];
			if ($.isArray(urls))
				return urls;
			return urls.split(";");			
		}
	}
})(jQuery);