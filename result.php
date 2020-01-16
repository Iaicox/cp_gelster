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
<body>
    <?php
    
    $pos1 = strpos($htmlData, '<div class="breadcrambs">');
    $tableStr = substr($htmlData, $pos1);
    $htmlData = explode('</main>', $tableStr)[0];
    
    echo "<div hidden>$htmlData</div>";
    
    ?>
<!--    <script>alert('Hi');</script>-->
    
    <div class="container">
        <button onclick="PastePageBreak(); window.print(); getPageBreaks();" style="position:fixed; top:50px; right:100px; padding:10px; cursor:pointer; border-radius:15px; border:0;">Печать</button>
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
                    <table class="clear table-items"></table>
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
                $curency = $_POST['curency'];
                $curencyClass;
                if ($curency == 'евро') {
                    $curencyClass = 'euro';
                } else {
                    $curencyClass = 'rub';
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
                        <th>Цена в <span class='rub'>руб.</span></th>
                        <th>Цена в <span class='euro'>евро</span></th>
                        <th>Сумма, в <span class='euro'>евро</span><br>с НДС</th>
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
                        $fifthMainValue = str_replace(' ', '', $mainMaterial["$counterRow, $counterCol"]);
                        $counterCol++;
                        $sixthMainValue = $fifthMainValue / $euroRate;
                        $seventhMainValue = $thirdMainValue * $sixthMainValue;
                            
                        $sumSixthMainValue += $seventhMainValue;
                        $thirdMainValue = number_format($thirdMainValue, 2, ',', ' ');
                        $fifthMainValue = number_format($fifthMainValue, 2, ',', ' ');
                        $sixthMainValue = number_format(($sixthMainValue), 2, ',', ' ');
                        $seventhMainValue = number_format(($seventhMainValue), 2, ',', ' ');
                        
                        $counterRow++;
                        $highArrMainMat--;
                        
                        echo "<tr>
                            <th>$firstMainValue</th>
                            <td>$secondMainValue</td>
                            <td>$thirdMainValue</td>
                            <td>$fourthMainValue</td>
                            <td>$fifthMainValue</td>
                            <td>$sixthMainValue</td>
                            <td>$seventhMainValue</td>
                        </tr>";
                    }
                    if ($highArrMainMat < 0) {
                        $sumSixthMainValueFin = number_format($sumSixthMainValue, 2, ',', ' ');
                        echo "<tr>
                            <th class='sum' colspan='6'>Итого в <span class='euro'>евро</span>, с НДС:</th>
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
                        <th>Цена в <span class='rub'>руб.</span></th>
                        <th>Цена в <span class='euro'>евро</span></th>
                        <th>Сумма, в <span class='euro'>евро</span><br>с НДС</th>
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
                        $fifthExtraValue = str_replace(' ', '', $additionalMaterial["$counterRow, $counterCol"]);
                        $counterCol++;
                        $sixthExtraValue = $fifthExtraValue / $euroRate;
                        $seventhExtraValue = $thirdExtraValue * $sixthExtraValue;
                        
                        $sumSixthExtraValue += $seventhExtraValue;
                        $thirdExtraValue = number_format($thirdExtraValue, 2, ',', ' ');
                        $fifthExtraValue = number_format($fifthExtraValue, 2, ',', ' ');
                        $sixthExtraValue = number_format(($sixthExtraValue), 2, ',', ' ');
                        $seventhExtraValue = number_format(($seventhExtraValue), 2, ',', ' ');
                        
                        $counterRow++;
                        $highArrAdditMat--;
                        
                        echo "<tr>
                            <th>$firstExtraValue.</th>
                            <td>$secondExtraValue</td>
                            <td>$thirdExtraValue</td>
                            <td>$fourthExtraValue</td>
                            <td>$fifthExtraValue</td>
                            <td>$sixthExtraValue</td>
                            <td>$seventhExtraValue</td>
                        </tr>";
                    }
                    if ($highArrAdditMat < 0) {
                        $sumSixthExtraValueFin = number_format($sumSixthExtraValue, 2, ',', ' ');
                        echo "<tr>
                            <th class='sum' colspan='6'>Итого в <span class='euro'>евро</span>, с НДС:</th>
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
                        <th>Общая сумма по позициям в <span class='euro'>евро</span>, с НДС:</th>
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
                echo "<span class='comment'>&mdash; $commentText</span>";
            }
            ?>
        </main>
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
            itemsTableContainer = document.getElementsByClassName('table-items')[0],
            itemsTableBody = document.createElement('tbody'),
            itemsTableTrImg = '',
            itemsTableTrDesc = '',
            itemContainer = document.getElementsByClassName('collection-container')[0],
            items = itemContainer.children,
            usefulItems = [],
            itemSrc = document.getElementsByClassName('art_item'),
            mainText,
            srcSeparator = window.location.hostname,
            pageBreak = document.createElement('div'),
            chapter = document.createElement('div'),
            featuresTable = document.getElementsByClassName('caracter-table')[0],
            fabricName = items[0].children[0].children[0].src.split('/')[3],
            euroRate = <?php echo $euroRate?>;
        var requestItems = <?php echo '"'.$_POST['itemsNumbers'].'"'?>.split(', ');
        
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
        for (var j=0; j < requestItems.length; j++) {
            for (var i=0; i < items.length; i++) {
                if (items[i].children[1].innerText == requestItems[j]) {
                    usefulItems[j] = items[i].children[0].innerHTML;
                }
            }
        }
        
        if (requestItems[0] == "") {
            itemsTableContainer.remove();
        }
        
        itemsTableContainer.innerHTML = '';
        
        for (var i=0; i<requestItems.length;) {
            
            itemsTableTrImg = "<tr>";
            itemsTableTrDesc = "<tr>";
            
            for (var j=0; j<4; j++, i++) {
                if (!(i == (requestItems.length))) {
                    itemsTableTrImg += '<td class="art_item">' + usefulItems[i] + '</td>';
                    itemsTableTrDesc += '<th><span>Арт. ' + requestItems[i] + '</th>';
                }
            }
            
            itemsTableTrImg += "</tr>";
            itemsTableTrDesc += "</tr>";
            itemsTableBody.innerHTML += itemsTableTrImg + itemsTableTrDesc;
        }
        
        itemsTableContainer.innerHTML += '<tbody>' + itemsTableBody.innerHTML + '</tbody>';
        
        for (var i=0; i<itemSrc.length; i++) {
            itemSrc[i].children[0].src = itemSrc[i].children[0].src.split(srcSeparator)[0] + 'www.ooogelingen.ru' + itemSrc[i].children[0].src.split(srcSeparator)[1];
        }
        
        document.getElementById('featuresHeader').innerText += collectionName;
        document.getElementsByClassName('table-features')[0].children[1].innerHTML = featuresTable.innerHTML;
        
        
    </script>
    <script>
        var headerHeight = 170,
            contentHeight = 805,
            footerHeight = 151,
            needToScroll,
            pastePageBreak;
        
        function PastePageBreak() {
            var docHeight = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight,
                                     document.body.offsetHeight, document.documentElement.offsetHeight,
                                     document.body.clientHeight, document.documentElement.clientHeight),
                winHeight = document.documentElement.clientHeight,
                scrollFromTop = window.pageYOffset,
                centerX = document.documentElement.clientWidth / 2,
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
                    pastePageBreak = document.elementFromPoint(centerX, winHeight-1);
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

                if (['TD','td','TH','th','img','IMG'].indexOf(pastePageBreak.tagName) !== -1) {
                    while (!(pastePageBreak.tagName == 'TABLE')) {
                        pastePageBreak = pastePageBreak.parentElement;
                    }
                }
                pastePageBreakParent = pastePageBreak.parentElement;
                pastePageBreakParent.insertBefore(pageBreak.cloneNode(true),pastePageBreak);
                pastePageBreakParent.insertBefore(chapter.cloneNode(true),pastePageBreak);
            }
        }
        
        function getPageBreaks() {
            var getBreak = document.getElementsByClassName('pagebreak'),
                getChapter = document.getElementsByClassName('chapter');
            for (var i=0; i<getBreak.length; i++) {
                getBreak[0].remove();
                getChapter[0].remove();
                getBreak[0].remove();
                getChapter[0].remove();
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
