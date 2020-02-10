<!DOCTYPE html>
<html lang="ru">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Итоговый вид КП</title>
    <link rel="stylesheet" href="style/style.css">
    <script src="https://code.jquery.com/jquery-3.3.1.min.js"></script>
    <script>
        
//        document.designMode = 'on';
    </script>
</head>

<?php
    $dir = "C:/ОБМЕН ФАЙЛАМИ/Сайт ooogelingen/www/kp/tmp/";
    $files = scandir( $dir );
    $time = time(); // Текущее время 
    $life_file = 86400; // Время жизни файла в секундах
    $time = $time - $life_file;
    foreach( $files as $file ) {
        if( $file != "." && $file != ".." )
        {
            $file = $dir.$file;
            $filemtime = filemtime( $file ); // Время создания или модификации файла

            // Удаляем, если нужно
            if( $filemtime <= $time )
            {
                unlink( $file );
            }
        }
    }
    $arr = [
      'января',
      'февраля',
      'марта',
      'апреля',
      'мая',
      'июня',
      'июля',
      'августа',
      'сентября',
      'октября',
      'ноября',
      'декабря'
    ];
    $month = date('n')-1;
    $client = $_POST['client'];
    $choosenFlooring = $_POST['chooseKindOfFlooring'];
    $choosenCharMain = $_POST['chooseKindChar'];
    $choosenCharSub = $_POST['chooseKindChar2'];
    $choosenFabric = $_POST['chooseFabric'];
    $clientName = $_POST['clientName'];
    $linkToItems = $_POST['linkToItems'];
    $managerEmail = $_POST['email'];
    $managerName = $_POST['name'];
    $collectionName = $_POST['collectionName'];
    $htmlData = file_get_contents($linkToItems);
    $euroRate = $_POST['euroRate'];
    
    $euroRate = str_replace(',','.',$euroRate);
    $euroRate = floatval($euroRate);
?>
<body onload="showItems();">
    <?php
    
    $pos1 = strpos($htmlData, '<div class="breadcrambs">');
    $tableStr = substr($htmlData, $pos1);
    $htmlData = explode('</main>', $tableStr)[0];
    
    echo "<div hidden>$htmlData</div>";
    
    ?>
    <span class="mark mark-header"><hr></span>
    <span class="mark mark-content-1"><hr></span>
    <span class="mark mark-footer"></span>
    
    <div class="container">
        <button onclick="PastePageBreak(); window.print(); getPageBreaks();" style="position:fixed; top:50px; right:100px; padding:10px; cursor:pointer; border-radius:15px; border:0; z-index: 100;">Сохранить в PDF</button>
        <header class="header">
            <div class="divHeader"><img class="header_img" src="style/header.jpg"></div>
        </header>
        <main class="content">
            <div class="date">
                <span class="dateToday"><?php echo "&laquo;".date("j")."&raquo; ".$arr[$month]." ".date("Y \г.");?></span>
                <span class="client">для <?php echo $client;?></span>
            </div>
            <div class="intro">
                <div class="intro-heading"><span>Коммерческое предложение на поставку <span class='lowercase flooring_name'></span> <span class="capitalize fabric_name"></span></span></div>
                <div class="intro-footing"><span>Уважаемый <?php echo $clientName."!";?></span></div>
            </div>
            <div class="mainContent">
                <div class="mainContent-heading"><p>Предлагаю Вам к рассмотрению <span class="lowercase flooring_name"></span>, а также сопутствующие материалы к нему.</p></div>
                <div class="collection-name-block">
                    <span class='kind-of-flooring'><span><span class='flooring_name'></span></span>&nbsp;&mdash;&nbsp;<span class='collection-name capitalize'></span></span>
                </div>
                <div class="mainContent-text">
                    <div class="mainContent-img">
                        <div class="main_img_wrapper"></div>
                    </div>
                    <div class="mainText"></div>
                    <div class="clear table_items-wrapper"></div>
                    <div class="linkToOtherItems"><span>Всю палитру можно посмотреть по ссылке: <?php echo "<a href='".$linkToItems."'>".$linkToItems."</a>";?></span></div>
                </div>
            </div>
            <br>
            <table class="table-features">
                <thead>
                    <tr>
                        <th colspan="2"><span>Технические характеристики <span class="capitalize" id="featuresHeader"></span>:</span></th>
                    </tr>
                </thead>
                <tbody></tbody>
            </table>
            <h3 class="preliminary-calc">Ниже приведены предварительные расчёты.</h3>
            <?php
                $mainCurChoose = $_POST['mainCurChoose'];
                $extraCurChoose = $_POST['extraCurChoose'];
                $mainCur = False;
                $extraCur = False;
                $mainColSpan=5;
                $extraColSpan=5;
                if ($mainCurChoose == 'rubAndEuro') {
                    $mainCur = True;
                    $mainColSpan=6;
                }
                if ($extraCurChoose == 'rubAndEuro') {
                    $extraCur = True;
                    $extraColSpan=6;
                }
                $mainMaterial = $_POST['mainMaterial'];
                $additionalMaterial = $_POST['additionalMaterial'];
                $highArrMainMat = count($mainMaterial)/5-1;
                $highArrAdditMat = count($additionalMaterial)/5-1;
                $counterRow=0;
                $counter=0;
                $sumSixthMainValue=0;
                $posMaterialCounter=0;
            ?>
            <table class="table-main_materials">
                <thead>
                    <tr>
                        <th>№</th>
                        <th>Основные материалы</th>
                        <th>Кол-во</th>
                        <th>Ед.<br>изм.</th>
                        <?php if ($mainCur) {echo '<th>Цена в <span class="euro">евро</span></th>';} ?>
                        <th>Цена в <span class='rub'>руб.</span></th>
                        <th>Сумма, в <span class='rub'>руб.</span><br>с НДС</th>
                    </tr>
                </thead>
                <tbody>
                    <?php
                    while ($highArrMainMat >= 0) {
                        $counterCol=0;
                        $firstMainValue = $mainMaterial["$counterRow, $counterCol"];
                        $counterCol++;
                        $secondMainValue = $mainMaterial["$counterRow, $counterCol"];
                        $counterCol++;
                        $thirdMainValue = str_replace(' ', '', $mainMaterial["$counterRow, $counterCol"]);
                        $counterCol++;
                        $fourthMainValue = $mainMaterial["$counterRow, $counterCol"];
                        $counterCol++;
                        $sixthMainValue = str_replace(' ', '', $mainMaterial["$counterRow, $counterCol"]);
                        $counterCol++;
                        $seventhMainValue = $thirdMainValue * $sixthMainValue;
                        
                        if ($mainCur) {
                            $fifthMainValue = $sixthMainValue / $euroRate;
                            $fifthMainValue = number_format($fifthMainValue, 2, ',', ' ');
                        }
                        
                        $sumSixthMainValue += $seventhMainValue;
                        $thirdMainValue = number_format($thirdMainValue, 2, ',', ' ');
                        $sixthMainValue = number_format(($sixthMainValue), 2, ',', ' ');
                        $seventhMainValue = number_format(($seventhMainValue), 2, ',', ' ');
                        
                        $counterRow++;
                        $highArrMainMat--;
                        
                        echo "<tr>
                            <th>$firstMainValue</th>
                            <td>$secondMainValue</td>
                            <td>$thirdMainValue</td>
                            <td>$fourthMainValue</td>";
                        if ($mainCur) {echo "<td>$fifthMainValue</td>";}
                        echo "<td>$sixthMainValue</td>
                            <td>$seventhMainValue</td>
                        </tr>";
                    }
                    if ($highArrMainMat < 0) {
                        $sumSixthMainValueFin = number_format($sumSixthMainValue, 2, ',', ' ');
                        echo "<tr>
                            <th class='sum' colspan='$mainColSpan'>Итого в <span class='rub'>руб.</span>, с НДС:</th>
                            <th class='sum'>$sumSixthMainValueFin</th>
                        </tr>";
                        $posMaterialCounter = $firstMainValue;
                    }
                    ?>
                </tbody>
            </table>
            <table class="table-addit_materials">
                <thead>
                    <tr>
                        <th>№</th>
                        <th>Дополнительные материалы</th>
                        <th>Кол-во</th>
                        <th>Ед.<br>изм.</th>
                        <?php if ($extraCur) {echo '<th>Цена в <span class="euro">евро</span></th>';} ?>
                        <th>Цена в <span class='rub'>руб.</span></th>
                        <th>Сумма, в <span class='rub'>руб.</span><br>с НДС</th>
                    </tr>
                </thead>
                <tbody>
                    <?php
                    $counterRow=0;
                    $counter=0;
                    $sumSixthExtraValue=0;
                    
                    while ($highArrAdditMat >= 0) {
                        $counterCol=0;
                        $firstExtraValue = ++$posMaterialCounter;
                        $counterCol++;
                        $secondExtraValue = $additionalMaterial["$counterRow, $counterCol"];
                        $counterCol++;
                        $thirdExtraValue = str_replace(' ', '', $additionalMaterial["$counterRow, $counterCol"]);
                        $counterCol++;
                        $fourthExtraValue = $additionalMaterial["$counterRow, $counterCol"];
                        $counterCol++;
                        $sixthExtraValue = str_replace(' ', '', $additionalMaterial["$counterRow, $counterCol"]);
                        $counterCol++;
                        $seventhExtraValue = $thirdExtraValue * $sixthExtraValue;
                        
                        if ($extraCur) {
                            $fifthExtraValue = $sixthExtraValue / $euroRate;
                            $fifthExtraValue = number_format($fifthExtraValue, 2, ',', ' ');
                        }
                        
                        $sumSixthExtraValue += $seventhExtraValue;
                        $thirdExtraValue = number_format($thirdExtraValue, 2, ',', ' ');
                        $sixthExtraValue = number_format(($sixthExtraValue), 2, ',', ' ');
                        $seventhExtraValue = number_format(($seventhExtraValue), 2, ',', ' ');
                        
                        $counterRow++;
                        $highArrAdditMat--;
                        
                        echo "<tr>
                            <th>$firstExtraValue.</th>
                            <td>$secondExtraValue</td>
                            <td>$thirdExtraValue</td>
                            <td>$fourthExtraValue</td>";
                        if ($extraCur) {echo "<td>$fifthExtraValue</td>";}
                        echo "<td>$sixthExtraValue</td>
                            <td>$seventhExtraValue</td>
                        </tr>";
                    }
                    if ($highArrAdditMat < 0) {
                        $sumSixthExtraValueFin = number_format($sumSixthExtraValue, 2, ',', ' ');
                        echo "<tr>
                            <th class='sum' colspan='$extraColSpan'>Итого в <span class='rub'>руб.</span>, с НДС:</th>
                            <th class='sum'>$sumSixthExtraValueFin</th>
                        </tr>";
                    }
                    ?>
                </tbody>
            </table>
            <?php 
            $firstSumValuesTables = ++$posMaterialCounter;
            $sumValueTables = $sumSixthMainValue + $sumSixthExtraValue;
            $sumValueTables = number_format($sumValueTables, 2, ',', ' ');
            ?>
            <table class="table-sum_tables">
                <thead>
                    <tr>
                        <th><?php echo $firstSumValuesTables; ?>.</th>
                        <th>Общая сумма по позициям в <span class='rub'>руб.</span>, с НДС:</th>
                        <th><?php echo $sumValueTables;?></th>
                    </tr>
                </thead>
            </table>
            <?php
            $comment = $_POST['comment'];
            $commentText = "Доставка до объекта рассчитывается отдельно.";
            if ($comment == 'да') {
                echo "<span class='comment'>&mdash; $commentText</span>";
            } elseif ($comment == 'нет') {                
            } else {
                $commentText = $_POST['commentText'];
                $commentTextCounter = 0;
                while ($commentTextCounter < count($commentText)) {
                    echo "<span class='comment'>&mdash;$commentText[$commentTextCounter]</span><br>";
                    $commentTextCounter++;
                }
            }
            ?>
        </main>
        <div id="toChooseItems" contenteditable="false">
            <span>Выбери артикулы:</span>
            <input type="button" value="Подтвердить" class="items_accept" onclick="setItemsOnPage(acceptChoosenItems());">
            <div class="choose_items_container"></div>
        </div>
        <footer class="footer">
            <?php
            $manager = $_POST['chooseManager'];
            ?>
            <div class="divFooter"><img class="footer_img" src="managers/<?php echo $manager?>"></div>
        </footer>
    </div>
    <script>
        var collectionName = document.getElementsByTagName('h1')[0].innerHTML.toLowerCase(),
            flooringName = document.getElementsByTagName('h2')[0].innerHTML,
            itemText1 = document.getElementsByClassName('entry-text')[0].innerHTML,
            itemText2 = document.getElementsByClassName('collapse')[0].innerHTML,
            mainImgSrc = document.getElementsByClassName('entry-photo')[0].children[0],
            itemContainer = document.getElementsByClassName('collection-container')[0],
            items = itemContainer.children,
            itemSrc = document.getElementsByClassName('art_item'),
            mainText,
            srcSeparator = window.location.host,
            pageBreak = document.createElement('div'),
            chapter = document.createElement('div'),
            featuresTable = document.getElementsByClassName('caracter-table')[0],
            fabricName = items[0].children[0].children[0].src.split('/')[3],
            euroRate = <?php echo $euroRate?>;
        
        pageBreak.className = 'pagebreak';
        chapter.className = 'chapter';
        pageBreak.innerHTML = '&nbsp;';
        chapter.innerHTML = '&nbsp;';
        
        mainText = itemText1 + itemText2;
        
        mainImgSrc.src = mainImgSrc.src.split(srcSeparator)[0] + 'www.ooogelingen.ru' + mainImgSrc.src.split(srcSeparator)[1];
        document.getElementsByClassName('entry-photo')[0].children[0].src = mainImgSrc.src;
        featuresTable.children[0].children[0].remove();
        
        for (var i=0; i<document.getElementsByClassName('flooring_name').length; i++) {
            document.getElementsByClassName('flooring_name')[i].innerHTML = flooringName;
        }
        
        document.getElementsByClassName('fabric_name')[0].innerHTML = fabricName;
        document.getElementsByClassName('collection-name')[0].innerHTML = collectionName;
        document.getElementsByClassName('main_img_wrapper')[0].innerHTML = mainImgSrc.outerHTML;
        document.getElementsByClassName('mainText')[0].innerHTML = mainText;
        
        /*    Артикулы    */
        
        function setItemsOnPage(items) {
            var itemsTableBody = document.createElement('tbody'),
                usefulItems = [],
                requestItems = [],
                itemsTableTrImg = '',
                itemsTableTrDesc = '',
                itemsTableContainer = document.getElementsByClassName('table_items-wrapper')[0],
                fullItemsTable = '';
            
            for (var i=0; i<items.length; i++) {
                usefulItems[i] = items[i].children[0].outerHTML;
                requestItems[i] = items[i].children[3].innerText;
            }

            itemsTableContainer.innerHTML = '';
            
            fullItemsTable += '<table class="table-items"><tbody>';

            for (var i=0; i<requestItems.length;) {

                itemsTableTrImg = "<tr>";
                itemsTableTrDesc = "<tr>";

                for (var j=0; j<4; j++, i++) {
                    if (i < requestItems.length) {
                        itemsTableTrImg += '<td class="art_item">' + usefulItems[i] + '</td>';
                        itemsTableTrDesc += '<th><span>Арт. ' + requestItems[i] + '</th>';
                    }
                }
                
                itemsTableTrImg += "</tr>";
                itemsTableTrDesc += "</tr>";
                
                if (((i%16) == 0) && (i !== requestItems.length)) {
                    fullItemsTable += itemsTableTrImg + itemsTableTrDesc + '</tbody></table><table class="table-items"><tbody>';
                } else {
                    fullItemsTable += itemsTableTrImg + itemsTableTrDesc;
                }
            }
            
            fullItemsTable += '</tbody></table>';
            itemsTableContainer.innerHTML += fullItemsTable;
            
            setEdit("td");
            setEdit("th");
            markContentHeight();
        }
        
        document.getElementById('featuresHeader').innerText += collectionName;
        document.getElementsByClassName('table-features')[0].children[1].innerHTML = featuresTable.innerHTML;
        
        
        function showItems() {
            var itemContainer = document.getElementsByClassName('choose_items_container')[0],
                itemsListSrc = document.getElementsByClassName('collection-container'),
                itemsList = [],
                srcSeparator = window.location.host;
            
            for (var i=0; i < itemsListSrc.length; i++) {
                for (var j=0; j<itemsListSrc[i].getElementsByClassName('col-auto').length; j++) {
                    itemsList.push(itemsListSrc[i].getElementsByClassName('col-auto')[j]);
                }
            }

            for (var i=0; i < itemsList.length; i++) {
                var itemImg = itemsList[i].getElementsByTagName('img')[0].cloneNode(true),
                    itemDesc = itemsList[i].getElementsByTagName('span')[0].cloneNode(true),
                    itemInput = document.createElement('input'),
                    itemBr = document.createElement('br'),
                    itemWrapper = document.createElement('div'),
                    itemLabel = document.createElement('label');

                itemWrapper.className = 'item_wrapper';
                itemInput.type = 'checkbox';
                itemInput.name = 'item_' + i;
                itemInput.value = itemDesc.innerHTML;
                itemImg.src = itemImg.src.split(srcSeparator)[0] + 'www.ooogelingen.ru' + itemImg.src.split(srcSeparator)[1];
                
                itemLabel.appendChild(itemImg);
                itemLabel.appendChild(itemBr);
                itemLabel.appendChild(itemInput);
                itemLabel.appendChild(itemDesc);
                itemWrapper.appendChild(itemLabel);
                itemContainer.appendChild(itemWrapper.cloneNode(true));
            }

            for (var i=0; i<document.getElementsByClassName('choose_items_container')[0].getElementsByTagName('img').length; i++) {
                document.getElementsByClassName('choose_items_container')[0].getElementsByTagName('img')[i].ondragstart = function() { return false; };
            }
        }
        
        function acceptChoosenItems() {
            var itemContainer = document.getElementsByClassName('choose_items_container')[0],
                itemsList = itemContainer.getElementsByTagName('input'),
                choosenItems = [];
            
            for (var i=0; i<itemsList.length; i++) {
                var check = itemsList[i].checked;
                
                if (check) {
                    choosenItems.push(itemsList[i].parentNode);
                }
            }
            
            if (choosenItems.length) {
                document.getElementById('toChooseItems').style.display = 'none';
                return(choosenItems);
            } else {
                alert("Вы не выбрали ни одного артикула.");
            }
        }
    </script>
    <script>
        var headerHeight = 170,
            contentHeight = 805,
            footerHeight = 151,
            centerX = document.documentElement.clientWidth / 2,
            needToScroll,
            pastePageBreak;
        
        function markContentHeight() {
             var docHeight = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight,
                                     document.body.offsetHeight, document.documentElement.offsetHeight,
                                     document.body.clientHeight, document.documentElement.clientHeight),
                 timesToPaste = Math.floor((docHeight-headerHeight-footerHeight)/(contentHeight-20)),
                 lastMark = document.getElementsByClassName('mark-footer')[0],
                 spanMark = document.createElement('span');
            
            spanMark.innerHTML = '<hr>';
            spanMark.className = 'mark';
            
            if (timesToPaste > 1) {
                for (var i=1; i<timesToPaste; i++) {
                    spanMark.className += ' mark-content-'+(i+1);
                    spanMark.style.top = (170+805*(i+1))+'px';
                    document.body.insertBefore(spanMark.cloneNode(true), lastMark);
                }
            }
        }
        
        function PastePageBreak() {
            var docHeight = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight,
                                     document.body.offsetHeight, document.documentElement.offsetHeight,
                                     document.body.clientHeight, document.documentElement.clientHeight),
                winHeight = document.documentElement.clientHeight,
                scrollFromTop = window.pageYOffset,
                timesToPaste = Math.floor((docHeight-headerHeight-footerHeight)/(contentHeight-20));
            
            window.scrollTo(0,0)
            
            for (var i=0; i<timesToPaste; i++) {
                if (winHeight < (headerHeight+contentHeight)) {
                    needToScroll = headerHeight+contentHeight-winHeight+20;
                    if (i==0) {
                        window.scrollTo(centerX,needToScroll);
                    } else {
                        document.getElementsByClassName('pagebreak')[(i-1)].scrollIntoView(false);
                        window.scrollBy(0, 800);
                    }
                    pastePageBreak = document.elementFromPoint(centerX, winHeight-2);
                } else {
                    if (i==0) {
                        window.scrollTo(centerX,headerHeight);
                        pastePageBreak = document.elementFromPoint(centerX, contentHeight);
                    } else if (i==(timesToPaste-1)) {
                        window.scrollTo(0,docHeight);
                        pastePageBreak = document.elementFromPoint(centerX, document.getElementsByClassName('pagebreak')[(i-1)].getBoundingClientRect().top + contentHeight);
                    } else {
                        document.getElementsByClassName('pagebreak')[(i-1)].scrollIntoView(false);
                        window.scrollBy(0, 800);
                        pastePageBreak = document.elementFromPoint(centerX, contentHeight);
                    }
                }
                
                
                if (['SPAN','span'].indexOf(pastePageBreak.tagName) !== -1) {
                    if (pastePageBreak.className !== 'comment') {
                        pastePageBreak = pastePageBreak.parentElement;
                    }
                }
                
                if (['TD','td','TH','th','TR','tr'].indexOf(pastePageBreak.parentElement.tagName) !== -1) {
                    pastePageBreak = pastePageBreak.parentElement;
                }
                

                if (['TD','td','TH','th','TR','tr','img','IMG','TBODY','tbody','THEAD','thead'].indexOf(pastePageBreak.tagName) !== -1) {
                    while (!(pastePageBreak.tagName == 'TABLE')) {
                        pastePageBreak = pastePageBreak.parentElement;
                    }
                }
                
                if (pastePageBreak.previousElementSibling && (['H3','h3'].indexOf(pastePageBreak.previousElementSibling.tagName) !== -1)) {
                    pastePageBreak = pastePageBreak.previousElementSibling;
                }
                
//                if ((pastePageBreak.className) || (pastePageBreak.parentElement.className) || (pastePageBreak.parentElement.parentElement.className)) {
//                    if (pastePageBreak.className == 'linkToOtherItems') {
//                        pastePageBreak = pastePageBreak.previousElementSibling;
//                    } else if (pastePageBreak.parentElement.className == 'linkToOtherItems') {
//                        pastePageBreak = pastePageBreak.parentElement.previousElementSibling;
//                    } else if (pastePageBreak.parentElement.parentElement.className == 'linkToOtherItems') {
//                        pastePageBreak = pastePageBreak.parentElement.parentElement.previousElementSibling;
//                    }
//                }
                
                pastePageBreakParent = pastePageBreak.parentElement;
                pastePageBreakParent.insertBefore(pageBreak.cloneNode(true),pastePageBreak);
                pastePageBreakParent.insertBefore(chapter.cloneNode(true),pastePageBreak);
            }
        }
        
        function getPageBreaks() {
            while (document.getElementsByClassName('pagebreak')[0] !== undefined) {
                document.getElementsByClassName('pagebreak')[0].remove();
                document.getElementsByClassName('chapter')[0].remove();
            }
        }
    </script>
    <script>
        function createCaretPlacer(atStart) {
            return function(el) {
                el.focus();
                if (typeof window.getSelection != "undefined"
                        && typeof document.createRange != "undefined") {
                    var range = document.createRange();
                    range.selectNodeContents(el);
                    range.collapse(atStart);
                    var sel = window.getSelection();
                    sel.removeAllRanges();
                    sel.addRange(range);
                } else if (typeof document.body.createTextRange != "undefined") {
                    var textRange = document.body.createTextRange();
                    textRange.moveToElementText(el);
                    textRange.collapse(atStart);
                    textRange.select();
                }
            };
        }
 
        var placeCaretAtStart = createCaretPlacer(true);
        var placeCaretAtEnd = createCaretPlacer(false);
        
        var arrDesignMode = ['p', 'img', 'td', 'th', 'span', 'h1', 'h2', 'h3'];
        for (var i=0; i < arrDesignMode.length; i++) {
            setEdit(arrDesignMode[i]);
        }
        
        function setEdit(elem) {
            $(elem)
            .click(function(e){
                if ($(e.currentTarget).attr('contenteditable') === 'true') return;
                $(e.currentTarget).attr('contenteditable', 'true');
                if ($(e.currentTarget)[0].localName == 'p') {
                    $(e.currentTarget)[0].style.display = 'table';
                }
                placeCaretAtEnd(e.currentTarget);
            })
            .blur(function(e){
                $(e.currentTarget).attr('contenteditable', 'false');
                if ($(e.currentTarget)[0].localName == 'p') {
                    $(e.currentTarget)[0].style.display = 'block';
                }
            })
            ;
        }
    </script>
</body>

</html>