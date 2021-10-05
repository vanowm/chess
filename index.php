<!DOCTYPE html>
<html>
<head>
  <meta http-equiv="content-type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Chess</title>
  <link rel="stylesheet" media="screen" href="chess.css">
</head>
<body>
    <div id="content" class="content">
    <div>
        <div id="capturedW" class="captured"></div>
        <div class="left"><div>8</div><div>7</div><div>6</div><div>5</div><div>4</div><div>3</div><div>2</div><div>1</div></div>
        <div class="top"><div>A</div><div>B</div><div>C</div><div>D</div><div>E</div><div>F</div><div>G</div><div>H</div></div>
        <div id="board" class="board chess"></div>
        <div class="bot"><div>A</div><div>B</div><div>C</div><div>D</div><div>E</div><div>F</div><div>G</div><div>H</div></div>
        <div class="right"><div>8</div><div>7</div><div>6</div><div>5</div><div>4</div><div>3</div><div>2</div><div>1</div></div>
        <div id="capturedB" class="captured"></div>
        <div class="right2">
        <div><button id="reset">reset</button>
        </div>
        <div class="turn">Turn: <span>white</span><span>black</span></div></div>
    </div>
    <div id="promotion"><li class="cell"></li><li class="cell"></li><li class="cell"></li><li class="cell"></li></div>
    <li id="captured" class="cell"></li>
    <div class="overlay"></div>
    </div>
    <script src="chess.js" content="text/javascript; charset=UTF-8"></script>
</body>
</html>

