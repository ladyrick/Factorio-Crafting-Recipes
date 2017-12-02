"use strict";
var width = 1500;
var height = 600;
var margin = { top: 10, right: 10, bottom: 10, left: 10 };

factorio.initialize = function () {
    // append the svg canvas to the page
    factorio.svg = d3.select("#chart")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    d3.select("#items").selectAll(".item")
        .data(factorio.craftItems.filter(d => d.craft.length !== 0))
        .enter().append("div")
        .attr("class", "item")
        .text((d) => d.name)
        .on("click", function (d) {
            var itemToCraft = d.name;
            document.querySelector("#goal > #name").textContent = itemToCraft;
            var numPerSecond = parseFloat(document.querySelector("#goal > #num").textContent);

            factorio.svg.selectAll("g").remove();
            factorio.display(d.name, numPerSecond);
        })
    d3.select("#goal input")
        .on("change", function () {
            var input = document.querySelector("#goal > input");
            var text = input.value;
            if (/^([0-9]+\.{0,1}[0-9]*|\.[0-9]+)$/.test(text)) {
                input.value = "";
                var numPerSecond = parseFloat(text);
                document.querySelector("#goal > #num").textContent = numPerSecond;
                var itemToCraft = document.querySelector("#goal > #name").textContent;
                factorio.svg.selectAll("g").remove();
                factorio.display(itemToCraft, numPerSecond);
            } else {
                alert("非数字输入。\n请输入一个整数或浮点数。");
                input.value = "";
            }
        })
    factorio.firstDisplay = true;
    return factorio;
};

factorio.display = function (itemToCraft = "科技包3", numPerSecond = 1) {

    if (factorio.firstDisplay) {
        factorio.firstDisplay = false;
        // set the goal in the page:
        document.querySelector("#goal > #name").textContent = itemToCraft;
        document.querySelector("#goal > #num").textContent = numPerSecond;
    }

    var formatNumber = d3.format(",.1f");    // zero decimal places
    var format = function (d) { return formatNumber(d); };
    var d3Color = d3.scale.category20();

    // Set the sankey diagram properties
    var sankey = d3.sankey()
        .nodeWidth(36)
        .nodePadding(40)
        .size([width, height]);


    var path = sankey.link();

    //search the itemTable to setup graph from the itemToCraft.
    function prepareGraph(itemToCraft, num = 1) {
        var nodes = {};
        var links = [];

        if (!(itemToCraft in factorio.craftItemsAsObject)) {
            alert("error! no item named " + itemToCraft);
            return factorio;
        }

        function searchMaterials(itemToCraft, num) {
            // make sure nodes are unique
            if (!(itemToCraft in nodes)) {
                nodes[itemToCraft] = { name: itemToCraft, num: 0, neededNum: 0 };
                nodes[itemToCraft].neededTool = "组装机2型";
                nodes[itemToCraft].speed = 3 / 4;
                if (["铁板", "铜板", "石砖", "钢材"].indexOf(itemToCraft) !== -1) {
                    nodes[itemToCraft].neededTool = "电炉";
                    nodes[itemToCraft].speed = 2;
                }
            }

            var item = factorio.craftItemsAsObject[itemToCraft];

            nodes[itemToCraft].num += num;

            if (item.craft.length === 0) {
                nodes[itemToCraft].neededTool = null;
                nodes[itemToCraft].neededNum = null;
                return 1;
            }

            nodes[itemToCraft].neededNum += item.time * num / nodes[itemToCraft].speed;

            var totalValue = 0;
            item.craft.forEach(function (material) {
                var value = searchMaterials(material.name, material.num * num);
                totalValue += value * material.num;

                var filteredLinks = links.filter(d => d.source === material.name && d.target === itemToCraft);
                if (filteredLinks.length === 1) {
                    filteredLinks[0].value += material.num * value * num;
                } else if (filteredLinks.length === 0) {
                    links.push({
                        source: material.name,
                        target: itemToCraft,
                        value: material.num * value * num
                    });
                } else {
                    alert("There is an error in links: duplicated!\nCheck your code please.");
                }
            });
            return totalValue;
        }

        searchMaterials(itemToCraft, numPerSecond);

        // prepare variable graph as the giving format. for example:
        // graph = { nodes: [{ name: "a" }, { name: "b" }], links: [{ source: 0, target: 1, value: 100 }] }
        var graph = { nodes: [], links: [] };

        for (var n in nodes) {
            nodes[n].index = graph.nodes.length;
            graph.nodes.push(nodes[n]);
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

    var graph = prepareGraph(itemToCraft, 1);

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
            var num;
            for (var c of factorio.craftItemsAsObject[d.target.name].craft) {
                if (c.name === d.source.name) {
                    num = c.num;
                }
            }
            return num + " x " + d.source.name + " → " + d.target.name;
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
            return d3Color(Math.floor(Math.random() * 20));
        })
        .append("title")
        .text(function (d) {
            return d.name + "\n数量：" + d.num + (d.neededTool ? ("\n" + d.neededTool + " x " + d.neededNum) : "");
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

factorio.initialize().display("科技包3", 1);