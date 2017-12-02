"use strict";
var width = 1500;
var height = 600;
factorio.initialize = function () {
    // append the svg canvas to the page
    factorio.svg = d3.select("#chart")
        .append("svg")
        .attr("width", width)
        .attr("height", height);

    d3.select("#items").selectAll(".item")
        .data(factorio.craftItems.filter(d => d.craft.length !== 0))
        .enter().append("div")
        .attr("class", "item")
        .text((d) => d.name)
        .on("click", function (d) {
            factorio.svg.selectAll("g").remove();
            factorio.display(d.name);
        })
    return factorio;
};

factorio.display = function (itemToCraft = "科技包1") {
    var formatNumber = d3.format(",.1f");    // zero decimal places
    var format = function (d) { return formatNumber(d); };
    var color = d3.scale.category20();

    // Set the sankey diagram properties
    var sankey = d3.sankey()
        .nodeWidth(36)
        .nodePadding(40)
        .size([width, height]);


    var path = sankey.link();

    //search the itemTable to setup graph from the itemToCraft.
    function prepareGraph(itemToCraft) {
        var nodes = {};
        var links = [];
        var nodeNums = 0;

        if (!(itemToCraft in factorio.craftItemsAsObject)) {
            alert("error! no item named " + itemToCraft);
            return factorio;
        }

        function searchMaterials(itemToCraft, count = 1) {
            // make sure nodes are unique
            if (itemToCraft in nodes) {
                nodes[itemToCraft].count += count;
            } else {
                nodes[itemToCraft] = { name: itemToCraft, count: count };
            }
            var item = factorio.craftItemsAsObject[itemToCraft];

            if (item.craft.length === 0) {
                return 1;
            }

            var totalValue = 0;
            item.craft.forEach(function (material) {
                var value = searchMaterials(material.name, material.count * count);
                totalValue += value * material.count;

                var filteredLinks = links.filter(d => d.source === material.name && d.target === itemToCraft);
                if (filteredLinks.length === 1) {
                    filteredLinks[0].value += material.count * value * count;
                } else if (filteredLinks.length === 0) {
                    links.push({
                        source: material.name,
                        target: itemToCraft,
                        value: material.count * value * count
                    });
                } else {
                    alert("There is an error in links: duplicated!\nCheck your code please.");
                }
            });
            return totalValue;
        }

        searchMaterials(itemToCraft);

        // prepare variable graph as the giving format. for example:
        // graph = { nodes: [{ name: "a" }, { name: "b" }], links: [{ source: 0, target: 1, value: 100 }] }
        var graph = { nodes: [], links: [] };

        for (var n in nodes) {
            nodes[n].index = graph.nodes.length;
            graph.nodes.push({ name: n });
        }

        graph.links = links.map(function (link) {
            return {
                source: nodes[link.source].index,
                target: nodes[link.target].index,
                value: link.value
            };
        });

        return graph;
    }

    var graph = prepareGraph(itemToCraft);

    sankey.nodes(graph.nodes)
        .links(graph.links)
        .layout(32);

    // add in the links
    var link = factorio.svg.append("g").selectAll(".link")
        .data(graph.links)
        .enter().append("path")
        .attr("class", "link")
        .attr("d", path)
        .style("stroke-width", function (d) { return Math.max(1, d.dy); })
        .sort(function (a, b) { return b.dy - a.dy; });

    // add the link titles
    link.append("title")
        .text(function (d) {
            return d.source.name + " → " +
                d.target.name + "\n" + format(d.value);
        });

    // add in the nodes
    var node = factorio.svg.append("g").selectAll(".node")
        .data(graph.nodes)
        .enter().append("g")
        .attr("class", "node")
        .attr("transform", function (d) {
            return "translate(" + d.x + "," + d.y + ")";
        })
        .call(d3.behavior.drag()
            .origin(function (d) { return d; })
            .on("dragstart", function () {
                this.parentNode.appendChild(this);
            })
            .on("drag", dragmove));

    // add the rectangles for the nodes
    node.append("rect")
        .attr("height", function (d) { return d.dy; })
        .attr("width", sankey.nodeWidth())
        .style("fill", function (d) {
            return d.color = color(d.name.replace(/ .*/, ""));
        })
        .append("title")
        .text(function (d) {
            return d.name + "\n" + format(d.value);
        });

    // add in the title for the nodes
    node.append("text")
        .attr("x", -6)
        .attr("y", function (d) { return d.dy / 2; })
        .attr("dy", ".35em")
        .attr("text-anchor", "end")
        .attr("transform", null)
        .text(function (d) { return d.name; })
        .filter(function (d) { return d.x < width / 2; })
        .attr("x", 6 + sankey.nodeWidth())
        .attr("text-anchor", "start");

    // the function for moving the nodes
    function dragmove(d) {
        d3.select(this).attr("transform",
            "translate(" + d.x + "," + (
                d.y = Math.max(0, Math.min(height - d.dy, d3.event.y))
            ) + ")");
        sankey.relayout();
        link.attr("d", path);
    }
    return factorio;
};

factorio.initialize().display("科技包3");