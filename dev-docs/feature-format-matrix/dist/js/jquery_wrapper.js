/*
 * This file is part of the Tabulator package.
 *
 * (c) Oliver Folkerd <oliver.folkerd@gmail.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 *
 * Full Documentation & Demos can be found at: http://olifolkerd.github.io/tabulator/
 *
 */

(function (root, factory) {
	"use strict";
	if (typeof define === 'function' && define.amd) {
		define(['jquery', 'tabulator', 'jquery-ui'], factory);
	}
	else if(typeof module !== 'undefined' && module.exports) {
		module.exports = factory(
			require('jquery'),
			require('tabulator'),
			require('jquery-ui')
		);
	}
	else {
		factory(root.jQuery, root.Tabulator);
	}
}(this, function ($, Tabulator) {

	$.widget("ui.tabulator", {
		_create:function(){
			var options = Object.assign({}, this.options);
			var props = [];

			delete options.create;
			delete options.disabled;

			this.table = new Tabulator(this.element[0], options);
			window.table = this.table;

			//retrieve properties on prototype
			props = Object.getOwnPropertyNames(Object.getPrototypeOf(Object.getPrototypeOf(this.table)));

			//retrieve properties added by modules
			props = props.concat(Object.getOwnPropertyNames(this.table));

			//map tabulator functions to jquery wrapper
			for(let key of props){
				if(typeof this.table[key] === "function" && key.charAt(0) !== "_"){
					this[key] = this.table[key].bind(this.table);
				}
			}
		},

		_setOption: function(option, value){
			console.error("Tabulator jQuery wrapper does not support setting options after the table has been instantiated");
		},

		_destroy: function(option, value){
			this.table.destroy();
		},
	});
}));
