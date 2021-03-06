/**
* Author: Nathan Winch
* Date: May 10, 2012
* Plugin Name: slacker
* Description: jQuery plugin for lazy loading images.
*/
;(function ( $, window, document, undefined ) {
	var pluginName = 'slacker',
        defaults = {
            animate : {
				beforeLoad : false
				, onLoad : false
			}
			, resize : true
			, resizeThrottle : 200
			, sizes : [640]
        }
        , $dockEl = $('<div />')
			.attr('id', pluginName + '-dock')
			.css({
				height : '1px'
				, left : '-99999em'
				, position : 'absolute'
				, top : 0
				, width : '1px'
			})
			.appendTo($('body'))
        , toType = function(obj) {
			return ({}).toString.call(obj).match(/\s([a-zA-Z]+)/)[1].toLowerCase();
		};


	/**
	* https://github.com/m-gagne/limit.js/blob/master/limit.js
	*
	* MODIFIED: line: now = Date.now() -> changed to: now = new Date().getTime() (this is now Old IE friendly).
	* @nwinch
	*
	* throttle
	* @param {integer} milliseconds This param indicates the number of milliseconds
	*     to wait between calls before calling the original function.
	* @return {function} This returns a function that when called will wait the
	*     indicated number of milliseconds between calls before
	*     calling the original function.
	*/
	Function.prototype.throttle = function (milliseconds) {
	    var baseFunction = this,
	        lastEventTimestamp = null,
	        limit = milliseconds;
	
	    return function () {
	        var self = this,
	            args = arguments,
	            now = new Date().getTime();
	
	        if (!lastEventTimestamp || now - lastEventTimestamp >= limit) {
	            lastEventTimestamp = now;
	            baseFunction.apply(self, args);
	        }
	    };
	};

    // The actual plugin constructor
    function Plugin( element, options ) {
        this.element = element;
        this.options = $.extend( {}, defaults, options) ;

        this._defaults = defaults;
        this._name = pluginName;
        this.$window = $(window);
        this.$dock = $dockEl;
        this.queue = { loaded:[], ready:[] };
		this.resSizes = {};
		this.mobileView = false;
		this.resizeLast = undefined;

        this.init();
    }

    Plugin.prototype = {
        
        init : function () {
        	var thisPlugin = this;
            
            // get screen size: mobile or default images?
			this.mobileView = this.checkForMobile(this.options, this.$window.width());
			
			// add resize event for adjusting images.
			if (this.options.resize) {
				this.$window.bind('resize.' + this._name, function(e) {
					var $self = $(this)
						, els = thisPlugin.queue.ready
						, screenW = $self.width()
						, found = false
						, num;
					
					// loop through all images that have been added to queue.
					for (var i=0,len=els.length; i<len; i++) {
						
						// always start with false: no resolution image has been found yet.
						found = false;
						
						// loop through all sizes for images, including the 'original' image.
						$.each(els[i].sizes, function(k, v) {
							num = parseInt(k);
							
							// check for resolution key images only (this will ignore 'original').
							// only found if resolution is found
							if (toType(num) === 'number' && screenW <= num) {
								thisPlugin.loadImage(els[i].el, thisPlugin.options, v);
								found = true;
								return false;
							}
						});
						
						// if resolution is not found we imply that user is on desktop and should be served original image.
						if (!found) {
							thisPlugin.loadImage(els[i].el, thisPlugin.options, els[i].sizes.original);
						}
					}
				}.throttle(this.options.resizeThrottle));
			}
			
			// check el for correct attributes.
    		if (!this.checkAtts(this.element)) {
    			return false;
    		}
    		
    		this.sortSizes(this.element, this.options);
        }
        // Does callback function exists?
		, callbackExists : function(cbObj, cbName) {
			if (cbObj.hasOwnProperty(cbName) && toType(cbObj[cbName]) === 'function') {
				return true;
			}
			
			return false;
		}
        // Are high resolution images are supported by current device?
		, supportHighRes : function() {
			return (window.devicePixelRatio > 1) ? true : false;
		}
		// Check we are viewing on a mobile device: the term 'mobile' is used loosely here 
		// as we using the check for anything other than 'original' image listings.
		, checkForMobile : function(options, screenW) {
			var flag = false;
			
			$.each(options.sizes, function(k, v) {
				if (screenW <= v) {
					flag = true;
				}
			});
			
			return flag;
		}
        // Sort through all sizes supplied in settings and trigger loadImage.
		, sortSizes : function(el, options) {
			var sizesIgnore = ['original']
				, sizesCount = 0
				, foundSize = undefined
				, foundImg = undefined
				, keyInt
				, screenW = this.$window.width();
			
			for (var i in this.resSizes) {
			    if (this.resSizes.hasOwnProperty(i)) {
			        sizesCount ++;
			    }
			}
			
			// check for other size images.
			// object keys must be widths.
			if (sizesCount > 1 && this.mobileView) {
				$.each(this.resSizes, function(key, val) {
					keyInt = parseInt(key);
					
					// if we find a screen res on the element that is the same as in setup, and user is viewing same resolution then..
					if (($.inArray(keyInt, options.sizes) >= 0) && (screenW <= keyInt)) {
						if (foundSize !== undefined && screenW <= foundSize) {
							return false;
						}
						
						foundSize = keyInt;
						foundImg = val;
					}
				});
				
				// found correctly sized image to load.
				if (foundImg !== undefined) {
					this.loadImage(el, options, foundImg, true);
				}
			} else {
				this.loadImage(el, options, this.resSizes.original, true);
			}
		}
        // Check what type of image needs to be loaded, preload a temporary image and then apply
        // load animation (if need be) and display image.
		, loadImage : function(el, options, img, anim) {
			var thisPlugin = this
				, $el = $(el)
				, elN = $el[0]
				, elTag = elN.tagName
				, animation = options.animate
				, cssExtra = {}
				, usingHighRes = false
				, tempImg
				, imgLoaded;
			
			// set 'anim' to false if we don't want animation.
			anim = anim || false;
			
			

			// if we are supporting high res images and it has been listed.
			if (Helper.toType(img) === 'object') {
				if (thisPlugin.supportHighRes()) {
					if (img.reshigh !== undefined) {
						img = img.reshigh;
						cssExtra = { backgroundSize:'100%' };
						usingHighRes = true;
					} else if (img.reshigh === undefined && img.reslow !== undefined) {
						img = img.reslow;
					}
				} else {
					if (img.reslow !== undefined) {
						img = img.reslow;
					}
				}
			}
			
			// if image already loaded, we don't need to load again - only if different.
			if (elN.src === img) {
				return false;
			}
				
			// check for onLoad animate event.
			if (this.callbackExists(animation, 'beforeLoad') && anim) {
				animation.beforeLoad.apply(this, [$el]);
			}
			
			// preload image to gather dimensions.
			$('<img />')
				.attr('src', img)
				.one('load', function() {
					var self = $(this)
						, maxWidth
						, ratio;

					self.appendTo(thisPlugin.$dock);
				
					// let's check for multiple types of elements.
					// if 'img' we can change src attribute, else if other tag then we change background-image.
					if (elTag.toLowerCase() === 'img') {
						elN.src = img;
					} else {
						$el.css($.extend({ backgroundImage : 'url(' + img + ')'}, cssExtra));
					}

					if (usingHighRes) {
						maxWidth = parseInt(self[0].width / 2);
				        ratio = 0;

				        // check if the current width is larger than the max
				        if (self[0].width > maxWidth) {
				            ratio = maxWidth / self[0].width;
				        }

				        ratio = { width:maxWidth, height:parseInt(self[0].height * ratio) };
					} else {
						ratio = { width:self[0].width, height:self[0].height };
					}

					// adjust height/width.
					$el.css(ratio);
					
					// check for onLoad animate event.
					if (thisPlugin.callbackExists(animation, 'onLoad') && anim) {
						animation.onLoad.apply(this, [$el]);
					}

					// remove temporary image from dom, not need anymore.
					self.remove();

				}).each(function() {
	  				if (this.complete) {
	  					$(this).load();
	  				}
				});
		}
		// Does element have the correct attributes?
		, checkAtts : function(el) {
			var $el = $(el)
				, jsonLazy = $el.data(this._name)
				, jsonStr = JSON.stringify(jsonLazy)
				, jsonObj = $.parseJSON(jsonStr);

			// check data-lazy is a well-formed JSON structure.
			if (!jsonLazy && toType(jsonObj) !== 'object') {
				return false;
			}
			
			// set sizes obj.
			this.resSizes = jsonLazy.sizes;
			
			// check if sizes property exists - image must have 'original' size.
			if (this.resSizes === undefined || this.resSizes.original === undefined) {
				return false;
			}
			
			// add element with sizes to queue.
			this.queue.ready.push({ el:$el, sizes:this.resSizes });
			
			return true;
		}
    };

    $.fn[pluginName] = function ( options ) {
        return this.each(function () {
            if (!$.data(this, 'plugin_' + pluginName)) {
                $.data(this, 'plugin_' + pluginName,
                new Plugin( this, options ));
            }
        });
    }

})( jQuery, window, document );