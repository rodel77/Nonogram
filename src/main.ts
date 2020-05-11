type colour = number[];

interface Palette {
    background: colour
    board:      colour
    tile:       colour
    cross:      colour
    tile_used:  colour
    fail:       colour
    numberUsed: colour
    text:       colour
};

// https://flatuicolors.com/palette/defo
const DEFAULT: Palette = {
    background: [52, 73, 94],
    board:      [149, 165, 166],
    tile:       [236, 240, 241],
    cross:      [231, 76, 60],
    tile_used:  [22, 160, 133],
    fail:       [0,0,0],
    numberUsed: [127, 140, 141],
    text:       [255, 255, 255],
};

const DEFAULT2: Palette = {
    background: [0x16, 0x24, 0x47],
    board:      [0x26, 0x24, 0x47],
    tile:       [0x1f, 0x40, 0x68],
    cross:      [0x1b, 0x1b, 0x2f],
    tile_used:  [0x1b, 0x1b, 0x2f],
    fail:       [0xe4, 0x3f, 0x5a],
    numberUsed: [127, 140, 141],
    text:       [0xff, 0xff, 0xff],
};

enum States {
    NONE,
    MARK,
    CROSS,
    ERROR,
}

interface Cell {
    io: boolean,
    state: States,
    animationAlpha: number,
};

class Sequence {
    completed: number | undefined = undefined;
    start: number;
    cells: Cell[] = [];

    constructor(start: number){
        this.start = start;
    }

    isCompleted(){
        for(let i = 0; i < this.cells.length; i++){
            if(this.cells[i].state!=States.MARK) return false;
        }
        return true;
    }

    addCell(cell: Cell) {
        this.cells.push(cell);
    }
}

function norVector2(vector: p5.Vector){
    return createVector(vector.x==0 ? 1 : 0, vector.y==0 ? 1 : 0);
}

class Strip {
    sequences: Sequence[] = [];
    orientation: p5.Vector; // 0 X, 1 Y

    constructor(orientation: p5.Vector){
        this.orientation = orientation;

        let vector = orientation.copy();
        let sequence: Sequence | undefined;
        for(let i = 0; i < grid.length; i++){
            if(orientation.x==0) vector.x++; else vector.y++;
            const cell = grid[vector.x-1][vector.y-1];
            if(cell.io){
                if(sequence==undefined) sequence = new Sequence(i);
                sequence.addCell(cell);
            }else if(sequence!=undefined){
                this.sequences.push(sequence);
                sequence = undefined;
            }
        }

        if(sequence!=undefined){
            this.sequences.push(sequence);
            sequence = undefined;
        }
    }

    allDone(): boolean {
        for(let i = 0; i < this.sequences.length; i ++){
            if(!this.sequences[i].isCompleted()) return false;
        }
        return true;
    }

    checkCompleted(): void {
        if(this.sequences.length==0) return;
        if(this.sequences.length==1){
            if(this.sequences[0].completed==undefined && this.sequences[0].isCompleted()){
                this.sequences[0].completed = Date.now();
            }
            return;
        }

        if(this.allDone()){
            for(let i = 0; i < this.sequences.length; i ++){
                if(this.sequences[i].completed==undefined){
                    this.sequences[i].completed = Date.now();
                }
            }
            return;
        }

        for(let i = 0; i < this.sequences.length; i++){
            const sequence = this.sequences[i];
            if(sequence.completed!=undefined) continue;
            if(!sequence.isCompleted()) continue;
            let x = this.orientation.x, y = this.orientation.y;

            if(x==0){
                x = sequence.start;
            }else{
                y = sequence.start;
            }

            if(x-1>=0 && y-1>=0 && grid[x-1][y-1].state!=States.CROSS) continue;

            if(this.orientation.x){
                y += sequence.cells.length+1;
            }else{
                x += sequence.cells.length+1;
            }

            if(x-1<grid.length && y-1<grid.length && grid[x-1][y-1].state!=States.CROSS) continue;

            sequence.completed = Date.now();
        }

        return;
    }
}

var palette: Palette = DEFAULT2;

var mouseState: States | undefined;

var selectedCell: Cell | undefined = undefined;

var grid: Cell[][];

var xStrips: Strip[] = [];
var xLargerStrip: number = 0;
var yStrips: Strip[] = [];
var yLargerStrip: number = 0;

var cursorAlpha = 0;

var erroring: Cell | undefined;

var touchEnabled = false;
var touching = false;
var toolAnimation = 1;

function collide(x1: number, y1: number, x2: number, y2:number, x: number, y:number): boolean {
    return x > x1 && y > y1 && x < x2 && y < y2;
}

function lerpColors(color1: colour, color2: colour, alpha: number){
    return [
        lerp(color1[0], color2[0], alpha),
        lerp(color1[1], color2[1], alpha),
        lerp(color1[2], color2[2], alpha),
    ];
}

function checkCompleted(cells: Cell[]){
    for(let i = 0; i < cells.length; i++){
        if(cells[i].state!=States.MARK){
            return false;
        }
    }
    return true;
}

function createGrid(size: number){
    grid = [];

    for(let x = 0; x < size; x++){
        grid[x] = [];
        for(let y = 0; y < size; y++){
            // const io = currentImage.get(x, y)[3]==0xFF;
            const io = Math.random()<.70;
            grid[x][y] = {
                io: io,
                state: (!io && Math.random()<.23) ? States.CROSS : States.NONE,
                // state: io ? States.CROSS : States.NONE,
                animationAlpha: 0,
            };
        }
    }

    for(let x = 0; x < size; x++){
        const yStrip = new Strip(createVector(x+1, 0))
        yLargerStrip = Math.max(yLargerStrip, yStrip.sequences.length);
        yStrips.push(yStrip);

        const xStrip = new Strip(createVector(0, x+1));
        xLargerStrip = Math.max(xLargerStrip, xStrip.sequences.length);
        xStrips.push(xStrip);
    }
}

let font;
var currentImage: p5.Image;

function preload(){
    font = loadFont("SourceSansPro-SemiBold.ttf");
    currentImage = loadImage("images/cactus.png");
}

function setup(){
    currentImage.loadPixels();
    createCanvas(windowWidth, windowHeight);
    background(palette.background);
    createGrid(10);
    textFont(font);

    document.addEventListener("contextmenu", e => e.preventDefault());

    if("ontouchstart" in document.documentElement){
        touchEnabled = true;
        mouseState = States.MARK
    }
}

function draw(){

    for(let i = 0; i < yStrips.length; i++){
        yStrips[i].checkCompleted();
        xStrips[i].checkCompleted();
    }

    // Draw background/board
    noStroke();
    fill(palette.background);
    rect(0, 0, windowWidth, windowHeight);
    fill(palette.board);
    const panelSize = Math.min(windowHeight, windowWidth)/1.3;
    const panelX = windowWidth/2 - panelSize/2, panelY = windowHeight/2 - panelSize/2;
    rect(panelX, panelY, panelSize, panelSize, 20, 20, 20, 20);

    const squareSize = panelSize * .75 / grid.length;

    if(touchEnabled){
        var x = panelX+panelSize/2;
        var y = panelY+panelSize*1.02;
        var s = squareSize;
        fill(0xff, 0xff, 0xff, 50);
        circle(x + ((s/1.5)*toolAnimation) + s/2, y + s/2 + s * .2, s*1.5);

        if(mouseState==States.MARK){
            toolAnimation = Math.min(toolAnimation+.2, 1);
        }else{
            toolAnimation = Math.max(toolAnimation-.2, -1);
        }

        fill(palette.tile_used)
        rect(x + s/1.5, y+ s * .2, s, s, grid.length / 2, grid.length / 2, grid.length / 2);

        if(touching){
            if(collide(x + s/1.5, y+ s * .2, x + s/1.5 + s, y+ s * .2 + s, mouseX, mouseY)){
                mouseState = States.MARK;
            }else if(collide(x - s/1.5, y+ s * .2, x - s/1.5 + s, y+ s * .2 + s, mouseX, mouseY)){
                mouseState = States.CROSS;
            }
        }
        
        fill(palette.fail)
        stroke(palette.tile_used);
        strokeWeight(7);
        push();
        translate(-s/1.5, 10);
        line(x + s * .2, y + s * .2, x+s * .8, y+s * .8);
        line(x + s * .8, y + s * .2, x+s * .2, y+s * .8);
        pop();
        noStroke();
    }
    push();

    if(erroring!=undefined){
        translate(Math.sin(Date.now() * .04)*20 * Math.sin(erroring.animationAlpha*Math.PI), 0);
    }

    // Draw grid
    var oldSelected = selectedCell;
    selectedCell = undefined;
    for(let gridX = 0; gridX < grid.length; gridX++){
        for(let gridY = 0; gridY < grid.length; gridY++){
            const cell = grid[gridX][gridY];
            const x = panelX + panelSize * .23 + gridX*squareSize+2,
                  y = panelY + panelSize * .23 +  gridY*squareSize+2, 
                  s = squareSize-4;

            cell.animationAlpha = Math.min(cell.animationAlpha + (cell.state==States.ERROR ? .03 : .05), 1);

            fill(palette.tile);

            if(cell.state==States.MARK){
                fill(lerpColors(palette.tile, palette.tile_used, cell.animationAlpha));
            }
            
            if(cell.state==States.ERROR){
                fill(lerpColors(palette.tile, palette.fail, Math.sin(cell.animationAlpha * Math.PI)));
                if(cell.animationAlpha==1){
                    erroring = undefined;
                    cell.state = States.NONE;
                }
            }
            
            rect(x, y, s, s, grid.length / 2, grid.length / 2, grid.length / 2);
            
            if(cell.state==States.CROSS){
                stroke(lerpColors(palette.tile, palette.cross, cell.animationAlpha));
                strokeWeight(7);
                line(x + s * .2, y + s * .2, x+s * .8, y+s * .8);
                line(x + s * .8, y + s * .2, x+s * .2, y+s * .8);
                noStroke();
            }

            if(collide(x, y, x+s, y+s, mouseX, mouseY) && cell.state!=States.ERROR){
                if(oldSelected!=cell) cursorAlpha = 0;
                cursorAlpha = Math.min(cursorAlpha + 5, 50);
                selectedCell = cell;
                if(!touchEnabled){
                    fill(0, 0, 0, cursorAlpha);
                    rect(x, y, s, s, grid.length / 2, grid.length / 2, grid.length / 2);
                }
            }

            if(gridY==0) {
                fill(palette.tile[0], palette.tile[1], palette.tile[2], 70);
                rect(x, y-s*((yLargerStrip-1)*.5+1) - 16, s, s*(yLargerStrip + 1)*.5, s/4, s/4, s/4, s/4);
                textSize(s/2);
                textAlign(CENTER, CENTER);
                yStrips[gridX].sequences.forEach((sequence, index) => {
                    if(sequence.completed!=undefined){
                        fill(lerpColors(palette.text, palette.numberUsed, (Math.min(Date.now()-sequence.completed, 500)/500)));
                    }else{
                        fill(0xFF, 0xFF, 0xFF);
                    }
                    text(Math.abs(sequence.cells.length), x, y-s*(index*.5+1) - 16, s, s)
                })
            }
            if(gridX==0) {
                fill(palette.tile[0], palette.tile[1], palette.tile[2], 70);
                rect(x-s*((xLargerStrip-1)*.5+1) - 16, y, s*(xLargerStrip + 1)*.5, s, s/4, s/4, s/4, s/4);
                textSize(s/2);
                textAlign(CENTER, CENTER);
                xStrips[gridY].sequences.forEach((sequence, index) => {
                    if(sequence.completed!=undefined){
                        fill(lerpColors(palette.text, palette.numberUsed, (Math.min(Date.now()-sequence.completed, 500)/500)));
                    }else{
                        fill(0xFF, 0xFF, 0xFF);
                    }
                    text(Math.abs(sequence.cells.length), x-s*(index*.5+1) - 16, y, s, s)
                })
            }
        }
    }

    pop();

    if(mouseState!=undefined && selectedCell!=undefined && selectedCell.state==States.NONE && (touchEnabled==touching)){
        if(selectedCell.io==(mouseState==States.MARK)){
            selectedCell.state = mouseState;
            selectedCell.animationAlpha = 0;
        }else{
            selectedCell.state = States.ERROR;
            selectedCell.animationAlpha = 0;
            if(touchEnabled){
                touching = false;
            }else{
                mouseState = undefined;
            }
            erroring = selectedCell;
        }
    }
}

window.touchStarted = function(){
    touching = true;
}

window.touchEnded = function(){
    touching = false;
}

window.mousePressed = function(event: MouseEvent){
    if(!touchEnabled){
        mouseState = event.button==0 ? States.MARK : States.CROSS;
    }
}

window.mouseReleased = function(){
    if(!touchEnabled){
        mouseState = undefined;
    }
}

window.windowResized = function(){
    resizeCanvas(windowWidth, windowHeight);
}