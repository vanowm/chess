(e =>
{
  const elBoard = document.getElementById("board"),
        elCaptB = document.getElementById("capturedB"),
        elCaptW = document.getElementById("capturedW"),
        elPromotion = document.getElementById("promotion"),
        elContent = document.getElementById("content"),
        elCell = document.createElement("li"),
        elStats = document.getElementById("stats"),
        elCaptured = document.getElementById("captured"),
        elReset = document.getElementById("reset");
  
  let clone,
      piece,
      targetPrev;

  class Chess
  {
    constructor(data)
    {
      this.init(data);
    }

    init(data)
    {
      this.pieces = {
        list: ["", "♚","♚","♛","♛","♜","♜","♝","♝","♞","♞","♟","♟",""/*en passant*/], //white odd, black even
        type: ["", "k", "k", "q", "q", "r", "r", "b", "b", "n", "n", "p", "p", "e"],
        name: ["", "King", "King", "Queen", "Queen", "Rook", "Rook", "Bishop", "Bishop", "Knight", "Knight", "Pawn", "Pawn", "En Passant"],
        k: 1,K: 2,
        q: 3,Q: 4,
        r: 5,R: 6,
        b: 7,B: 8,
        n: 9,N: 10,
        p: 11,P: 12,
        e: 13, //en passant
        1: "k",2:"K",
        3: "q",4:"Q",
        5: "r",6:"R",
        7: "b",8:"B",
        9: "n",10:"N",
        11:"p",12:"P",
        13:"e",
        0: "", "":0
      };
    this.stats = {
        pieces: {},
        moves: 0,
        time: {
          black: 0,
          white: 0
        },
        captured: [],
        enpassant: { //https://en.wikipedia.org/wiki/Chess#En_passant
          black: 0,
          white: 0
        },
        castling: { //https://en.wikipedia.org/wiki/Chess#Castling
          black: 0,
          white: 0
        },
        promotion: { //https://en.wikipedia.org/wiki/Chess#Promotion
          black: 0,
          white: 0
        },
        check: {
          black: 0,
          white: 0
        }
      };
      this.mustMove = false;
      this.pieceMustMove = null;
      this.piece = null; //active piece
      this.check = false;
      this.checkmate = false;
      if (data !== undefined)
        data = typeof data == "string" ? data : this.load(data);

      if (!data)
        data = this.default;

      this.table = [...new Array(64)].fill(0);
      if (Object.seal)
        Object.seal(this.table);

      this.castling = [3, 3]; //bitwise, odd = king side, even queen side
      this.turn = (data.match(/[tT]/) || ["t"])[0] == "t";
      this.captured = (data.match(/a([qrbnpKQRBNP]+)/) || ["", ""])[1]
                      .replace(/[^qrbnpQRBNP]/g, "")
                      .split("")
                      .filter(e => this.pieces[e])
                      .map(e => this.pieces[e]);

      const regexTable = /([kqrbnpeKQRBNP])([0-9]+)/g,
            regexCastling = /([cC])([0-9]+)/g;

      let p;
      while ((p = regexTable.exec(data)) !== null)
      {
        const index = ~~p[2] & 63,
          id = ~~this.pieces[p[1]];

        if (this.table[index]) //treat overlaping figures as captured
        {
          this.captured.push(this.table[index], id);
          this.table[index] = 0;
        }
        else
          this.table[index] = id;
      }

      while ((p = regexCastling.exec(data)) !== null)
        this.castling[~~(p[1] == "C")] = ~~p[2] & 3;

      //make sure pieces position is correct for castling
      this.castling.forEach((c, i) =>
      {
        const side = i % 2;
        if (c)
        {
          if (this.pieces.type[this.table[[4, 60][side]]] != "k")
            c = 0;
          else
          {
            if (c & 1 && this.pieces.type[this.table[[0, 56][side]]] != "r")
              c &= 2;

            if (c & 2 && this.pieces.type[this.table[[7, 63][side]]] != "r")
              c &= 1;
          }
        }
        this.castling[i] = c;
      });

      elPromotion.querySelectorAll(".cell").forEach((e, i) =>
      {
        e.dataset.piece = this.pieces.list[i * 2 + 3];
      });

    }

    get default()
    {
      return "r0n1b2q3k4b5n6r7p8p9p10p11p12p13p14p15P48P49P50P51P52P53P54P55R56N57B58Q59K60B61N62R63";
    }

    reset()
    {
      this.init();
    }

    isPromotion(index)
    {
      const side = this.table[index] % 2,
             type = this.pieces.type[this.table[index]];

      return !(type != "p" || (index < [64, 56][side] && index > [7, -1][side]))
    }

    getMoves(index, check, silent)
    {
      const piece = this.table[index],
            _data = check || [...this.table],
            side = piece % 2,
            dir = side ? 1 : -1,
            [x, y] = this.i2xy(index),
            r = [],
            move = (xo, yo) => [x + dir * xo, y + dir * yo],
            one = move(1),
            type = this.pieces.type[piece],
            steps = type == "k" ? 2 : 9,
            canMoveTo = (xy, notEmpty, enpassant) =>
            {
              let pieceDest = _data[this.xy2i(...xy)],
                  colorDest = pieceDest == this.pieces.e && enpassant ? !side : pieceDest % 2;

              if (!enpassant && pieceDest == this.pieces.e)
                pieceDest = 0;

              if (pieceDest && colorDest != side)
                return pieceDest;

              return (!notEmpty && pieceDest === 0);
            };
      if (!check)
      {
        const moves = this.getMoves(index, _data);
        _data[index] = 0;
        const castling = [];
        if (type == "k")
        {
          if (this.castling[~~!side] & 1)
            castling.push([59, 3][side]);
          if (this.castling[~~!side] & 2)
            castling.push([61, 5][side]);
        }

        for (let n = 0, d, prev; n < moves.length; n++)
        {
          d = [..._data];
          d[moves[n]] = piece;
          if (this.isCheck(side, d, silent) || Math.abs(prev - moves[n]) == 1) // king castling crossing attacked square?
          {
            if (castling.indexOf(moves[n]) != -1)
              prev = moves[n];

            if (this.pieces.type[_data[moves[n]]] != "k")
              moves.splice(n--, 1);
          }
        }
        return moves;
      }
      let d;

      if (type == "p") //pawn
      {
        d = move(0, 1);
        let c = canMoveTo(d);

        if (c === true)
        {
          r.push(c > 0 ? this.xy2i(...d) : c);
          d = move(0, 2);
          c = canMoveTo(d);
          if (((side && y == 1) || (!side && y == 6)) && c === true)
            r.push(this.xy2i(...d));
        }
        d = move(-1, 1);
        if (canMoveTo(d, true, true))
          r.push(this.xy2i(...d));

        d = move(1, 1);
        if (canMoveTo(d, true, true))
          r.push(this.xy2i(...d));
      }
      if (type == "r" || type == "q" || type == "k") // rook // queen // king
      {
        for (let i = 1, c, path = []; i < steps; i++)
        {
          //top
          d = move(0, -i);
          c = canMoveTo(d);
          if (!path[0] && c) r.push(this.xy2i(...d));
          if (c !== true) path[0] = 1;

          //right
          d = move(i, 0);
          c = canMoveTo(d);
          if (!path[1] && c) r.push(this.xy2i(...d));
          if (c !== true) path[1] = 1;

          //bottom
          d = move(0, i);
          c = canMoveTo(d);
          if (!path[2] && c) r.push(this.xy2i(...d));
          if (c !== true) path[2] = 1;

          //left
          d = move(-i, 0);
          c = canMoveTo(d);
          if (!path[3] && c) r.push(this.xy2i(...d));
          if (c !== true) path[3] = 1;
        }
      }
      if (type == "b" || type == "q" || type == "k") // bishop // queen // king
      {
        for (let i = 1, c, path = []; i < steps; i++)
        {
          //top right
          d = move(i, i);
          c = canMoveTo(d);
          if (!path[0] && c) r.push(this.xy2i(...d));
          if (c !== true) path[0] = 1;

          //bottom right
          d = move(i, -i);
          c = canMoveTo(d);
          if (!path[1] && c) r.push(this.xy2i(...d));
          if (c !== true) path[1] = 1;

          //bottom left
          d = move(-i, -i);
          c = canMoveTo(d);
          if (!path[2] && c) r.push(this.xy2i(...d));
          if (c !== true) path[2] = 1;

          // top left
          d = move(-i, i);
          c = canMoveTo(d);
          if (!path[3] && c) r.push(this.xy2i(...d));
          if (c !== true) path[3] = 1;
        }
      }
      if (type == "n") // knight
      {
        //top right
        d = move(1, 2);
        canMoveTo(d) && r.push(this.xy2i(...d));

        //top left
        d = move(-1, 2);
        canMoveTo(d) && r.push(this.xy2i(...d));

        //right top
        d = move(2, 1);
        canMoveTo(d) && r.push(this.xy2i(...d));

        //right bottom
        d = move(2, -1);
        canMoveTo(d) && r.push(this.xy2i(...d));

        //bottom right
        d = move(1, -2);
        canMoveTo(d) && r.push(this.xy2i(...d));

        //bottom left
        d = move(-1, -2);
        canMoveTo(d) && r.push(this.xy2i(...d));

        //left bottom
        d = move(-2, -1);
        canMoveTo(d) && r.push(this.xy2i(...d));

        //left top
        d = move(-2, 1);
        canMoveTo(d) && r.push(this.xy2i(...d));

      }
      if (type == "k" && !this.stats.pieces[piece]) // king castling
      {
        let rook = side ? 0 : 56; //left side
        if (this.castling[~~!side] & 1)
        {
          if (canMoveTo(move(-1 * dir, 0)) && canMoveTo(move(-2 * dir, 0)) && !_data[rook + 1])
            r.push(rook + 2);
        }
        rook = side ? 7 : 63; //right side
        if (this.castling[~~!side] & 2)
        {
          if (canMoveTo(move(1 * dir, 0)) && canMoveTo(move(2 * dir, 0)))
            r.push(rook - 1);
        }
      }

      //console.log(r);
      return r;
    } //getMoves()

    i2xy(i)
    {
      return [i % 8, ~~(i / 8)];
    }

    xy2i(x, y)
    {
      return x < 0 || y < 0 || x > 7 || y > 7 ? -1 : y * 8 + x;
    }

    isCheck(side, d, silent)
    {
      if (!d)
        d = [...this.table];

      const king = d.indexOf(side ? this.pieces.k : this.pieces.K);
      for (let i = 0, m; i < 64; i++)
      {
        if (d[i] && side != d[i] % 2)
        {
          m = this.getMoves(i, d);
          if (!silent)
          {
            m.forEach(a =>
            {
              if (!elBoard.children[a].m)
                elBoard.children[a].m = {};

              elBoard.children[a].m[d[i]] = this.pieces.list[d[i]];
              const b = Object.keys(elBoard.children[a].m).map(p => this.pieces.list[p]).join("");
              elBoard.children[a].dataset["canmove" + (side ? "B" : "W")] = (b.slice(8) ? b.slice(8) + "\n" : "") + (b.slice(4, 8) ? b.slice(4, 8) + "\n" : "") + b.slice(0, 4);
            });
          }
          if (m.indexOf(king) != -1)
          {
            this.check = true;
            return true;
          }

        }
      }
      this.check = false;

      return false;
    }

    load(id)
    {
      return localStorage.getItem("chess" + (id || ""));
    }

    save(id)
    {
      return localStorage.setItem("chess" + (id || ""), this.string);
    }

    get string()
    {
      const r = [];
      for (let i = 0; i < 64; i++)
      {
        if (this.table[i])
        {
          r[r.length] = this.pieces[this.table[i]] + i;
        }
      }
      this.castling.forEach((d, i) => r[r.length] = ["c", "C"][i] + d);
      r[r.length] = ["T", "t"][~~this.turn];

      if (this.captured.length)
        r[r.length] = "a" + this.captured.map(c => this.pieces[c]).join("");

      return r.join("");
    }
  }
  let prevMatch = localStorage.getItem("chess");
//  const chess = new Chess("r0n16k31b6r7p48p33p12p38P27q41n1K59p13p10b18P8P49P50p53P14P55R40N57B60Q25B61N62R63c3C3TaPPp"); //[...new Array(64)].fill(0);
  const chess = new Chess("Q2p10p13n16q18k19e20p28K35Q37p38P55N62R63c0C0TaPPprBqPnQrNqRbbBPpP"); //[...new Array(64)].fill(0);
  //const chess = new Chess(0); //[...new Array(64)].fill(0);
  updateBoard();

  function updateBoard()
  {
    elBoard.classList.toggle("black", !chess.turn);
    chess.table.forEach((p, i) =>
    {
      const s = elBoard.children[i] || elCell.cloneNode(false),
            nomoves = s.classList.contains("nomoves");

      s.className = "cell";
      s.classList.toggle("black", p && !(p % 2));
      s.classList.toggle("nomoves", nomoves);
      s.title = chess.pieces.name[p];
      if (s === chess.piece)
        s.classList.add("active");

      s.textContent = " " + i;
      s.dataset.piece = chess.pieces.list[p] || "";
      delete s.dataset.canmoveW;
      delete s.dataset.canmoveB;
      delete s.m;
      if (!elBoard.children[i])
        elBoard.appendChild(s);

    });
    chess.table.forEach((p, i) =>
    {
      elBoard.children[i].classList.toggle("available", p && p % 2 == chess.turn && chess.getMoves(i, undefined, true).length);
    });
    /* display captured pieces */
    let it = [0, 0];
    chess.captured.forEach(p =>
    {
      const type = p % 2,
        el = type ? elCaptW : elCaptB,
        i = it[type]++,
        s = el.children[i] || elCell.cloneNode(false);

      s.className = "cell";
      s.classList.toggle("black", !type);
      s.dataset.piece = chess.pieces.list[p] || "";
      s.title = chess.pieces.name[p];
      if (!el.children[i])
        el.appendChild(s);
    });
    while (it[0] < elCaptB.children.length)
      elCaptB.removeChild(elCaptB.lastChild);

    while (it[1] < elCaptW.children.length)
      elCaptW.removeChild(elCaptW.lastChild);

    if (elCaptured.dataset.piece)
    {
      const capt = (elCaptured.classList.contains("black") ? elCaptB : elCaptW).lastChild;
      elCaptured.classList.add("captured");
      elCaptured.style.left = capt.offsetLeft + "px";
      elCaptured.style.top = capt.offsetTop + "px";
      elCaptured.piece = capt;
      capt.classList.add("hidden");
    }
    const checkmate = [true, true],
          attacking = [],
          king = [chess.table.indexOf(chess.pieces.K), chess.table.indexOf(chess.pieces.k)];

    for (let i = 0, pID; i < chess.table.length; i++)
    {
      pID = chess.table[i];
      if (!pID)
        continue;

      //	if (!(checkmate[0] + checkmate[1]))
      //    	break;

      const type = pID % 2;
      //    if (!checkmate[type])
      //    	continue;
      const moves = chess.getMoves(i, undefined, true);
      if (!moves.length)
        continue;

      if (moves.indexOf(king[~~!type]) != -1)
        attacking.push(i);

      checkmate[type] = false;
    }
    attacking.forEach((a, i) =>
    {
      elBoard.children[a].classList.add("attacking");
      elBoard.children[king[~~!(chess.table[a] % 2)]].classList.add("check");

    });
    checkmate.forEach((c, i) =>
    {
      if (!c)
        return;

      chess.checkmate = true;
      elBoard.children[king[i % 2]].classList.add("checkmate");
    });

    showPromotion();
    elContent.classList.toggle("black", !chess.turn);
  } //updateBoard()

  function showPromotion(index)
  {
    //  alert("promotion on startup is broken");
    if (index === undefined)
    {
      for (let i = 0, index; i < 8; i++)
      {
        index = i;
        if (chess.table[index] == chess.pieces.P)
          showPromotion(index);

        index = i + 56;
        if (chess.table[index] == chess.pieces.p)
          showPromotion(index);
      }
      return false;
    }
    const target = elBoard.children[index],
          side = chess.table[index] % 2;

    if (!target || !chess.isPromotion(index))
      return false;

    elContent.classList.add("promotion");
    elPromotion.classList.toggle("black", !side);
    const rect = target.getBoundingClientRect();
    elPromotion.style.top = rect.y + (side ? rect.height : 0) + "px";
    elPromotion.style.left = rect.x + "px";
    chess.piece = target;
    chess.turn = !chess.turn;

    return true;
  } //showPromotion()

  function onMouseDown(e)
  {
    e.preventDefault();
    if (e.button || chess.checkmate || (e.target.parentNode !== elBoard && e.target.parentNode !== elPromotion))
      return;

    if (e.target.parentNode === elPromotion)
    {
      let pIndex = Array.prototype.indexOf.call(chess.piece.parentNode.children, chess.piece),
           promo = Array.prototype.indexOf.call(e.target.parentNode.children, e.target);

      chess.table[pIndex] = promo * 2 + 3 + ~~!(chess.table[pIndex] % 2);
      elContent.classList.remove("promotion");
      chess.turn = !chess.turn;
      chess.save();
      updateBoard();
      return;
    }
    if (elContent.classList.contains("promotion"))
      return;
    chess.piece = e.target;
    const index = Array.prototype.indexOf.call(chess.piece.parentNode.children, chess.piece),
          value = chess.table[index];

    if (!value || chess.turn != value % 2)
      return;

    if (chess.mustMove && chess.pieceMustMove && chess.pieceMustMove != chess.piece)
      return;

    if (!chess.getMoves(index, undefined, true).length)
    {
      chess.piece.classList.add("nomoves");
      
      return ;//updateBoard();
    }
    chess.piece.moves = chess.getMoves(index);
    chess.pieceMustMove = chess.piece;
    clone = chess.piece.cloneNode(false);
    //  clone.className = "cell";
    clone.classList.toggle("black", !(value % 2));
    clone.classList.remove("active");
    clone.classList.remove("attacking");
    clone.classList.toggle("move", true);
    x = chess.piece.clientWidth / 2;
    y = chess.piece.clientHeight / 2;
    elBoard.appendChild(clone);
    chess.piece.classList.toggle("active", true);
    elBoard.classList.toggle("move", true);
    //  chess.table.forEach((p,i) => elBoard.children[i].classList.remove("canmove"));
    chess.piece.moves.forEach(i => elBoard.children[i].classList.add("canmove"));
    onMouseMove(e);
  }

  function onMouseMove(e)
  {
    if (!clone)
      return;

    clone.style.left = (e.x + (e.pageX - e.x) - x) + "px";
    clone.style.top = (e.y + (e.pageY - e.y) - y) + "px";
    let targets = document.elementsFromPoint(e.x, e.y),
        target = null;

    for (let i = 0; i < targets.length; i++)
    {
      if (targets[i] !== clone && targets[i].classList.contains("cell"))
      {
        target = targets[i];
        break;
      }
    }
    if (target)
    {
      if (targetPrev && target != targetPrev)
        targetPrev.classList.remove('over');

      targetPrev = target;
      const index = Array.prototype.indexOf.call(target.parentNode.children, target);
      target.classList.toggle("over", chess.piece.moves.indexOf(index) > -1);
    }
    else if (targetPrev)
    {
      targetPrev.classList.remove("over");
    }
  }

  function onMouseUp(e)
  {
    //  if (!clone)
    //    return;
    if (clone)
      elBoard.removeChild(clone);

    elBoard.classList.remove("move");
    clone = null;

    let target = document.elementFromPoint(e.x, e.y),
        promotion = false;

    if (!target.closest("#board") && !target.closest("#promotion"))
      return;
  
    const tIndex = Array.prototype.indexOf.call(target.parentNode.children, target);
    if (target.parentNode === elBoard && chess.piece && chess.piece.moves && chess.piece.moves.indexOf(tIndex) > -1)
    {
      let tID = chess.table[tIndex];
      const pIndex = Array.prototype.indexOf.call(chess.piece.parentNode.children, chess.piece),
            pID = chess.table[pIndex],
            pType = chess.pieces.type[pID],
            tType = chess.pieces.type[tID],
            pSide = pID % 2,
            tSide = (tType != "e" ? tID : ~~(!pSide)) % 2,
            pIsBlack = ~~!(pID % 2);

      if (tType != "k")
      {
        if (!chess.stats.pieces[pID])
          chess.stats.pieces[pID] = {
            moves: 0,
            captured: []
          };

        chess.stats.pieces[pID].moves++;
        if (tID && tSide != pSide)
        {
          if (tType == "e")
          {
            if (pType == "p")
            {
              const nIndex = tIndex + (tSide ? 8 : -8);
              tID = chess.table[nIndex];
              chess.table[nIndex] = 0;
            }
            else
              tID = 0;

          }
          if (tID)
          {
            chess.stats.pieces[pID].captured.push(tID);
            chess.captured.push(tID);
          }
        }
        elCaptured.dataset.piece = chess.pieces.list[tID];
        elCaptured.classList.toggle("black", pSide);
        elCaptured.style.left = target.offsetLeft + "px";
        elCaptured.style.top = target.offsetTop + "px";
        chess.table[tIndex] = pID;

        let p;
        while ((p = chess.table.indexOf(chess.pieces.e)) != -1)
          chess.table[p] = 0;

        const moved = pIndex - tIndex;
console.log(chess.stats);
        if (pType == "k" && (moved == 2 || moved == -2))
        {
          const rook = tIndex + (moved > 0 ? -2 : 1);

          chess.table[pIndex + (moved > 0 ? -1 : 1)] = chess.table[rook];
          chess.table[rook] = 0;
        }
        chess.table[pIndex] = 0;

        if (chess.piece !== target)
        {
          let castlingSide = -1,
              castlingVal = [0, 0];

          if (pType == "k")
          {
            castlingSide = [4, 60].indexOf(pIndex);
          }
          if (pType == "r")
          {
            castlingSide = [0, 56, 7, 63].indexOf(pIndex);
            castlingVal = [2, 1];
          }
          if (castlingSide > -1)
            chess.castling[~~(castlingSide % 2)] &= castlingVal[~~(castlingSide / 2 % 2)];

          chess.turn = !chess.turn;
          chess.mustMove = null;

          if (pType == "p")
          {
            //en passant
            if (Math.abs(pIndex - tIndex) == 16)
            {
              chess.table[pIndex > tIndex ? tIndex + 8 : tIndex - 8] = chess.pieces.e;
            }

          }
        }
      }
      //console.log(chess.stats);
    }
    const boardStatus = chess.string;
    if (!promotion)
      chess.save();

    chess.piece && delete chess.piece.moves;
    chess.piece = null;
     updateBoard();
  }
  function movePiece(from, to)
  {
  }
  document.addEventListener("mousedown", onMouseDown, false);
  document.addEventListener("mouseup", onMouseUp, false);
  document.addEventListener("mousemove", onMouseMove, false);
  document.addEventListener("contextmenu", e => e.preventDefault(), false);
  elReset.addEventListener("click", e => 
  {
    chess.reset();
    updateBoard();
  });

  function animationend(e)
  {
    if (e.target.classList.contains("nomoves"))
      e.target.classList.remove("nomoves");

    if (e.target.id == "captured")
    {
      e.target.classList.remove("captured");
      delete e.target.dataset.piece;
      e.target.removeAttribute("style");
      e.target.piece.classList.remove("hidden");
    }
  }
  elContent.addEventListener("animationend", animationend);
  elContent.addEventListener("transitionend", animationend);
})();
