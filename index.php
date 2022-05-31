<?php
  if ($_SERVER['QUERY_STRING'])
  {
    function getColor($c)
    {
      preg_match("/^(?:([a-fA-F0-9]{3})|([a-fA-F0-9]{6})|([a-fA-F0-9]{8}))$/", $c, $m);
      if ($m)
        $c = "#" . $m[1] . $m[2] . $m[3];

      return $c;
    }
    $colors = array("unset" /* body */, "transparent" /* accent */);
    $piece = @file_get_contents("pieces/" . preg_replace_callback("/^([a-zA-Z0-9]+)(?:[_-]([a-zA-Z0-9]+)(?:[_-]([a-zA-Z0-9]+))?)?$/", 
      function($m)
      {
        global $colors;
        $color = getColor($m[2]);
        if ($color)
          $colors[0] = $color;

        $color = getColor($m[3]);
        if ($color)
          $colors[1] = $color;

        return $m[1];
      }, $_SERVER['QUERY_STRING']) . ".svg");

    
    $piece = str_replace(array("BODY","ACCENT"), $colors, $piece);
    header("Content-Type: image/svg+xml");
    exit($piece);
  }
?>
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
          <div id="timeBlack"></div>
          <div class="turn">Turn: <span>white</span><span>black</span><div id="timeTurn"></div></div>
          <div class="totalTime">Total: <span id="timeTotal"></span></div>
        <div id="timeWhite"></div>
        </div>
    </div>
    <div id="promotion"><li class="cell"></li><li class="cell"></li><li class="cell"></li><li class="cell"></li></div>
    <li id="captured" class="cell"></li>
    <div class="overlay"></div>
    </div>
    <div><button id="reset">reset</button></div>
    <script src="chess.js" content="text/javascript; charset=UTF-8"></script>
</body>
</html>

