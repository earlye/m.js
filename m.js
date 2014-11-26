var m = {

    modules: { },

    _unique: (new Date()).getTime(),

    assert: function( invariant, message ) {
        if (!invariant) {
            console.error(message);
            throw new Error(message);
        }
    },

    makeAbsolute : function(url,relativeTo) {
        console.log( "makeAbsolute:" + url + " relativeTo:" + relativeTo );

        if ( relativeTo == undefined )
        {
            console.log( "relative to what?" );
            return url;
        }

        if ( url.match( /^\// ) )
        {
            console.log( "the url is absolute." );
            return url;
        }

        if ( url.match( /^https?:\/\// ))
        {
            console.log( "the url is *REALLY* absolute." );
            return url;
        }

        var relativeToParts = relativeTo.split('/');
        var urlParts = url.split('/');
        relativeToParts.pop();
        while( true )
        {
            console.log( "relativeToParts:" + JSON.stringify( relativeToParts ));
            console.log( "urlParts:" + JSON.stringify( urlParts ));
            if (urlParts[0] == "." )
            {
                urlParts.shift();
                continue;
            }
            if (urlParts[0] == ".." )
            {
                urlParts.shift();
                relativeToParts.pop();
                continue;
            }

            var url = relativeToParts.concat(urlParts);
            var result = url.join('/');

            console.log( "result:" + result );
            return result;

            break;
        }
    },

    getUnique : function() {
        return this._unique++;
    },

    modulesJson : function() {
        return JSON.stringify( this.modules , function(key,value) {
            if ( key === "modules" )
                return "/* modules */";
            return value;
        });
    },

    bootstrap: function () {
        console.log( "initializing m.js" );

        this.modules.e = this;

        var head = document.getElementsByTagName('head');
        this.assert( head != undefined ,"Must have a <head> tag" );

        var elements = document.querySelectorAll('script[main]');
        this.assert( elements != undefined , "Must have at least one <script> tag with a main attribute" );
        this.assert( elements.length === 1 , "Must have ONLY one <script> tag with a main attribute" );

        var element = elements[0];
        this.src = element.src;

        this.loadModule("polyfills", "polyfills.js?_=" + this._unique++, function() {
            this.modules.polyfills.initialize();
            //console.log( "loading main script" );
            var mainScript = element.attributes['main'].value;
            this.assert( mainScript.length != 0 , "main attribute must not be empty." );
            this.loadModule("main", mainScript + "?_=" + this.getUnique(), function() {
                this.assert( this.modules.main , "Main module must exist." );
                this.assert( this.modules.main.initialized , "Main module must be initialized." );
                this.assert( this.isCallable(this.modules.main.main) , "Main module must have a main function:" + this.modules.main.main );
                //console.log("initialized modules prior to running main:" + this.modulesJson() );
                this.modules.main.main();
            }.bind(this))
        }.bind(this), this.src);
    },

    isCallable: function( value ) { return typeof value === 'function'; },

    loadModule: function( name, url , callback , relativeToUrl ) {
        if ( this.modules[name] !== undefined ) {
            console.log( "module already exists:" + name );
            this.initModuleOnce(name,callback);
            return;
        }

        url = this.makeAbsolute(url,relativeToUrl);
        console.log( "loading script:" + url );

        var head = document.getElementsByTagName('head');
        this.assert( head != undefined ,"Must have a <head> tag" );
        this.assert( head.length != 0, "Must have a <head> tag inside document.getElementsByTagName('head')" );
        head = head[0];

        var script = document.createElement('script');
        script.src=url;
        script.async=true;
        script.onload=function() {
            var module = this.modules[name];
            if (module === undefined) {
                console.warn( name + ": script did not provide a module definition. " + url );
                // If the script did not define a module, that's okay - it could just be a non-m module.
                this.modules[name] = { name: name , initialized : false , url: url };
            }
            this.initModuleOnce(name,callback);
        }.bind(this);
        head.appendChild(script);
    },

    initModuleOnce: function (moduleName,callback) {

        //console.log( moduleName + " - trying to init" );
        var module = this.modules[moduleName];
        if ( module.initialized ) {
            //console.log( moduleName + " - previously inited" );
            return;
        }

        this.assert( module, "can only init a module if it is already loaded." );

        if ( module.dependencies ) {
            for( var name in module.dependencies ) {
                var dependency = this.modules[name];
                if ( dependency && dependency.initialized )
                    continue;

                if ( dependency ) {
                    // the module definition has been loaded, but the dependency is not initialized,
                    // so initialize it, and then try again to initialize this module.
                    this.initModuleOnce(name,function(){
                        //console.log( moduleName + " - initialized dependency:" + name );
                        this.initModuleOnce(moduleName,callback);
                    }.bind(this));
                    return;
                }

                // the dependency does not have a corresponding module definition
                var url = module.dependencies[name].url;
                this.loadModule(name,url,function() {
                    //console.log( moduleName + " - loaded dependency:" + name );
                    this.initModuleOnce(moduleName,callback);
                }.bind(this),module.src);
                return;
            };
        }

        //console.log( moduleName + " - dependencies complete." );
        if ( !module.initialized ) {
            //console.log( moduleName + " - is not initialized. Initializing it now." );
            if ( this.isCallable( module.initialize ) )
                module.initialize();
            module.initialized = true;
        }
        //console.log( moduleName + " - initialized." );
        if ( this.isCallable(callback ) ) {
            callback();
        }

    },

    module: function( module ) {
        //console.log( "adding module definition:" + JSON.stringify( module ));
        this.modules[module.name] = module;
    }



};

window.addEventListener("load", m.bootstrap.bind(m), false);
