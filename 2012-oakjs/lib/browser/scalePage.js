/*
	Export script, included in exported pages from Studio.

	This will VISUALLY scale the pages to a "scale" parameter,
		eg: "foo.html?scale=2" to scale visually to twice "natural" size.

	Note that you can pass "width" and "height" URL parameters as well,
	which will override the sizes we would otherwise derive from the
	<catalog-page> element in the HTML.

*/

var params = {
	scale : undefined,
	width : undefined,
	height: undefined
};
window.location.search.substr(1).split("&").forEach(function(param) {
	param = param.split("=");
	params[param[0]] = parseFloat(param[1]) || undefined;
});

function scalePage() {
	if (!params.scale) params.scale = 1;

	var body = document.getElementsByTagName("body")[0];
	if (!body) return console.warn("No <body> element found.  Bailing.");

	var page = document.getElementsByTagName("catalog-page")[0];
	if (!page) return console.warn("No <catalog-page> element found.  Bailing.");


	if (!params.width)  params.width  = page.offsetWidth;
	if (!params.height) params.height = page.offsetHeight;


// UNCOMMENT TO OUTPUT OUR PARAMETERS INLINE INTO THE PAGE (eg: so you can see the param values in phantomjs)
//body.innerHTML = ("<h1>scale: "+ params.scale+ "<br>width: "+ params.width+ "<br>height: "+ params.height+"</h1>");

	// ALWAYS explicitly set the size of the body
	body.style.width = (params.width*params.scale) + "px";
	body.style.height = (params.height*params.scale) + "px";

	// if scale not specified, or it's set to 1 then skip all of the below.
	if (params.scale == 1) return;

	page.style.width = params.width + "px";
	page.style.height = params.height + "px";
	page.style.transform = "scale("+params.scale+")";
	page.style.transformOrigin = "0 0";
	page.style.WebkitTransform = "scale("+params.scale+")";		// NOTE: necessary for phantomjs
	page.style.WebkitTransformOrigin = "0 0";					// NOTE: necessary for phantomjs

// ENABLE THE BELOW TO MAKE SURE THE CODE IS GETTING ALL THE WAY THROUGH
//	body.style.backgroundColor = "red";
//	page.style.backgroundColor = "pink";
}

scalePage();
