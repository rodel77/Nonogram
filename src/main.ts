type colour = number[];

interface Palette {
    background: colour
    board:      colour
    tile:       colour
    cross:      colour
    tile_used:  colour
    fail:       colour
    numberUsed: colour
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

// https://flatuicolors.com/palette/defo
const DEFAULT: Palette = {
    background: [52, 73, 94],
    board:      [149, 165, 166],
    tile:       [236, 240, 241],
    cross:      [231, 76, 60],
    tile_used:  [22, 160, 133],
    fail:       [0,0,0],
    numberUsed: [127, 140, 141]
};

const DEFAULT2: Palette = {
    background: [0x16, 0x24, 0x47],
    board:      [0x16, 0x24, 0x47],
    tile:       [0x1f, 0x40, 0x68],
    cross:      [0x1b, 0x1b, 0x2f],
    tile_used:  [0x1b, 0x1b, 0x2f],
    fail:  [0xe4, 0x3f, 0x5a],
    numberUsed: [127, 140, 141]
};

var palette: Palette = DEFAULT2;

var mouseState: States | undefined;

var selectedCell: Cell | undefined = undefined;

var grid: Cell[][];
var xNumbers: number[][];
var xNumbersHigher: number = 0;
var yNumbers: number[][];
var yNumbersHigher: number = 0;

var cursorAlpha = 0;

var erroring: Cell | undefined;

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

function createGrid(size: number){
    grid = [];

    for(let x = 0; x < size; x++){
        grid[x] = [];
        for(let y = 0; y < size; y++){
            const io = currentImage.get(x, y)[3]==0xFF;
            grid[x][y] = {
                io: io,
                state: (!io && Math.random()<.1) ? States.CROSS : States.NONE,
                animationAlpha: 0,
            };
        }
    }

    xNumbers = [];
    for(let x = 0; x < size; x++){
        xNumbers[x] = [];
        let count = 0;
        for(let y = 0; y < size; y++){
            if(grid[x][y].io){
                count++;
            }else{
                if(count>0) xNumbers[x].push(count);
                count = 0;
            }
        }
        if(count>0) xNumbers[x].push(count);
        xNumbersHigher = Math.max(xNumbersHigher, xNumbers[x].length);
    }

    yNumbers = [];
    for(let y = 0; y < size; y++){
        yNumbers[y] = [];
        let count = 0;
        for(let x = 0; x < size; x++){
            if(grid[x][y].io){
                count++;
            }else{
                if(count>0) yNumbers[y].push(count);
                count = 0;
            }
        }
        if(count>0) yNumbers[y].push(count);
        yNumbersHigher = Math.max(yNumbersHigher, yNumbers[y].length);
    }
}

let font;
var currentImage: p5.Image;

function preload(){
    font = loadFont("SourceSansPro-SemiBold.ttf");
    currentImage = loadImage("images/cactus.png");
}

function setup(){
    // console.log("A")
    currentImage.loadPixels();
    createCanvas(windowWidth, windowHeight);
    background(palette.background);
    createGrid(10);
    textFont(font);

    document.addEventListener("contextmenu", e => e.preventDefault());
}

function draw(){
    // Draw background/board
    noStroke();
    fill(palette.background);
    rect(0, 0, windowWidth, windowHeight);
    fill(palette.board);
    const panelSize = Math.min(windowHeight, windowWidth)/1.3;
    const panelX = windowWidth/2 - panelSize/2, panelY = windowHeight/2 - panelSize/2;
    rect(panelX, panelY, panelSize, panelSize, 20, 20, 20, 20);

    const squareSize = panelSize * .75 / grid.length;

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
                fill(0, 0, 0, cursorAlpha);
                rect(x, y, s, s, grid.length / 2, grid.length / 2, grid.length / 2);
            }

            if(gridY==0) {
                fill(palette.tile[0], palette.tile[1], palette.tile[2], 70);
                rect(x, y-s*((xNumbersHigher-1)*.5+1) - 16, s, s*(xNumbersHigher + 1)*.5, s/4, s/4, s/4, s/4);
                textSize(s/2);
                textAlign(CENTER, CENTER);
                xNumbers[gridX].forEach((v, index) => {
                    if(v<0){
                        fill(0xEE, 0xEE, 0xEE)
                    }else{
                        fill(0xFF, 0xFF, 0xFF)
                    }
                    text(Math.abs(v), x, y-s*(index*.5+1) - 16, s, s)
                })
            }
            if(gridX==0) {
                fill(palette.tile[0], palette.tile[1], palette.tile[2], 70);
                rect(x-s*((yNumbersHigher-1)*.5+1) - 16, y, s*(yNumbersHigher + 1)*.5, s, s/4, s/4, s/4, s/4);
                textSize(s/2);
                textAlign(CENTER, CENTER);
                yNumbers[gridY].forEach((v, index) => {
                    if(v<0){
                        fill(palette.numberUsed);
                    }else{
                        fill(0xFF, 0xFF, 0xFF);
                    }
                    text(Math.abs(v), x-s*(index*.5+1) - 16, y, s, s)
                })
            }
        }
    }

    pop();

    if(mouseState!=undefined && selectedCell!=undefined && selectedCell.state==States.NONE){
        if(selectedCell.io==(mouseState==States.MARK)){
            selectedCell.state = mouseState;
            selectedCell.animationAlpha = 0;
        }else{
            selectedCell.state = States.ERROR;
            selectedCell.animationAlpha = 0;
            mouseState = undefined;
            erroring = selectedCell;
        }

        var last: Cell | undefined;
        var count = 0;
        for(let y = 0; y < grid.length; y++){
            for(let x = 0; x < grid.length; x++){
                const cell = grid[x][y];

                if(count>0){
                    console.log("Stoping at", x)
                    if(cell.state==States.MARK){
                        count++;
                    }else if(cell.state==States.CROSS){
                        console.log("Ending at cross, ergo counting", count)
                        for(let i = 0; i < yNumbers[y].length; i++){
                            if(yNumbers[y][i]==count){
                                yNumbers[y][i]=-count;
                                break;
                            }
                        }
                        count = 0;
                    }else if(cell.state==States.NONE){
                        console.log("Ending at none", count, ":");
                        if(yNumbers[y].length==1){
                            for(let i = 0; i < yNumbers[y].length; i++){
                                if(yNumbers[y][i]==count){
                                    yNumbers[y][i]=-count;
                                    break;
                                }
                            }
                        }
                        count = 0;
                    }
                }

                if(count==0 && cell.state==States.MARK && (last==undefined || last.state==States.CROSS || yNumbers[y].length==1)){
                    count++;
                    console.log("Count")
                }
                last = cell;
            }

            if(count>0){
                for(let i = 0; i < yNumbers[y].length; i++){
                    if(yNumbers[y][i]==count){
                        yNumbers[y][i]=-count;
                        break;
                    }
                }
                count = 0;
            }
        }
    }
}

window.mousePressed = function(event: MouseEvent){
    mouseState = event.button==0 ? States.MARK : States.CROSS;
}

window.mouseReleased = function(){
    mouseState = undefined;
}

window.windowResized = function(){
    resizeCanvas(windowWidth, windowHeight);
}