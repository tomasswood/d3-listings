var width = 1920,
    height = 1080,
    ANIMATION_LENGTH = 1000,
    ANIMATION_LENGTH_LONG = 1000;

var rateById = d3.map();

var quantize = d3.scale.quantize()
    .domain([0, 0.15])
    .range(d3.range(9).map(function(i) { return "q" + i + "-9"; }));

var projection = d3.geo.albersUsa()
    .scale(width)
    .translate([width / 2, height / 2]);

var path = d3.geo.path()
    .projection(projection);

var svg = d3.select("#d3-map").append("svg")
    .attr("width", width)
    .attr("height", height);

queue()
    .defer(d3.json, "files/src/us.json")
    .defer(d3.json, "files/src/listing.json")
    .await(ready);

function ready(error, us, unemployment) {
    if (error) throw error;

    unemployment.data.forEach(function(a) {
        rateById.set(a.id, { 
            rate: +a.rate
        });
    });

    svg.append("g")
        .attr("class", "counties")
    .selectAll("path")
        .data(topojson.feature(us, us.objects.counties).features)
    .enter().append("path")
        .attr("id", function(d) { 
            return "id-" + d.id;
        })
        .attr("class", function(d) { 
            var data        = rateById.get(d.id) || {}; 
            var centroid    = path.centroid(d);
            rateById.set(d.id, { 
                rate: +data.rate,
                x: centroid[0],
                y: centroid[1],
            });
            return quantize(data.rate);
        })
        .attr("d", path);

    svg.append("path")
        .datum(topojson.mesh(us, us.objects.states, function(a, b) { return a !== b; }))
        .attr("class", "states")
        .attr("d", path);

    setTimeout(loadLines, 3000);
}

function changeCountyStyle( item_id )
{
    var fill    = item_id.style("fill");
    item_id
        .transition().duration( ANIMATION_LENGTH )
            .style("fill", "#ff8a00")
        .transition().delay( ANIMATION_LENGTH ).duration( ANIMATION_LENGTH_LONG )
            .style("fill", fill);
}

function loadLines()
{
    queue().defer(d3.json, "files/src/booking.json").await(function(error, source) {
        if (error) throw error;

        // spawn links between cities as source/target coord pairs
        var links       = [],
            arcLines    = [];
        source.data.forEach(function(a) {

            var source_set  = rateById.get(a.source);
            var dest_set    = rateById.get(a.dest);

            links.push({
                source: [ source_set.x, source_set.y, a.source ],
                target: [ dest_set.x, dest_set.y, a.dest ]
            });
        });

        // build geoJSON features from links array
        links.forEach(function(d,i,a) {
            var feature =   [ { x: +d.source[0], y: +d.source[1], id: +d.source[2] }, { x: +d.target[0], y: +d.target[1], id: +d.target[2] } ];
            arcLines.push(feature);
        });

        if( arcLines.length > 0 )
        {
            var stagger_time = arcLines.length * 1000;
            var line = svg.selectAll("link").data(arcLines);

            line.enter()
                .append("path")
                .transition()
                    .delay(function(d,i) {     

                        var _this = this;                    

                        setTimeout(function() {

                            var node = d3.select(_this);
                            node.attr("d", function(d) {
                                var dx = d[1].x - d[0].x,
                                    dy = d[1].y - d[0].y,
                                    dr = Math.sqrt(dx * dx + dy * dy);
                                return "M" + d[0].x + "," + d[0].y + "A" + dr + "," + dr + " 0 0,1 " + d[1].x + "," + d[1].y;
                            })
                            .attr("class", "arc")
                            .each(function(d) { changeCountyStyle( d3.select('#id-' + d[0].id) ); d.totalLength = this.getTotalLength(); })
                            .attr("stroke-dasharray", function(d) { return d.totalLength + " " + d.totalLength; })
                            .attr("stroke-dashoffset", function(d) { return d.totalLength; })
                            .transition()
                                .duration( ANIMATION_LENGTH_LONG )
                                .ease("linear")
                                .attr("stroke-dashoffset", 0)
                                .each("end", function(d) {
                                
                                    changeCountyStyle( d3.select('#id-' + d[1].id) );

                                    node      
                                        .transition()
                                        .duration( ANIMATION_LENGTH_LONG )
                                        .ease("linear")
                                        .attr("stroke-dashoffset", function(d) { return -d.totalLength; });
                                });

                        }, ( i * ANIMATION_LENGTH_LONG ) / 2);
                        return 0; 
                    });

            line.exit().remove();
            setTimeout(loadLines, ( arcLines.length * ANIMATION_LENGTH_LONG ) / 2 );
        }
        else
        {
            setTimeout(loadLines, 10000);
        }
    });
}