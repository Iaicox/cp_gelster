<!DOCTYPE html>
<html lang="ru">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Итоговый вид КП</title>
    <link rel="stylesheet" href="style/style.css">
    <script>document.designMode = "on";</script>
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
?>

<body>
    <div class="container">
        <button onclick="window.print();" style="position:fixed; top:50px; right:100px; padding:10px; cursor:pointer; border-radius:15px; border:0;">Печать</button>
        <header class="header">
            <div class="divHeader"><img class="header_img" src="style/header.jpg"></div>
        </header>
        <main class="content">
            <div class="date">
                <span class="dateToday"><?php echo "&laquo;".date("j")."&raquo; ".$arr[$month]." ".date("Y \г.");?></span>
                <span class="client">для <?php echo $client;?></span>
            </div>
            <div class="intro">
                <div class="intro-heading">
                    Коммерческое предложение на поставку <?php echo "<span class='loweracse'>".$choosenFlooring."а </span><span>".$choosenFabric."</span>";?>
                </div>
                <div class="intro-footing">Уважаемый <?php echo $clientName."!";?></div>
            </div>
            <div class="mainContent">
                <div class="mainContent-heading"><p>Предлагаю Вам к рассмотрению <?php echo $choosenCharMain." ".$choosenCharSub." ".$choosenFlooring." ".$choosenFabric;?>, а также сопутствующие материалы к нему. Этот <?php echo $choosenFlooring;?> предназначен для использования в <b>чистых помещениях</b>!</p></div>
                <div class="collection-name-block">
                    <?php
                    echo "<span class='kind-of-flooring'><span class='capitalize'>$choosenFlooring</span> $choosenCharMain $choosenCharSub</span>&nbsp;&mdash;&nbsp;<span class='collection-name'>$collectionName</span>";
                    ?>
                </div>
                <div class="mainContent-text">
                    <div class="mainContent-img">
                       <?php
                            $imagePath = "C:/ОБМЕН ФАЙЛАМИ/Сайт ooogelingen/www/kp/tmp/";   //The path you wish to upload the image to
                            $image = $_POST['pic'];                //Stores the filename as it was on the client computer.
                            $imagename = $_FILES['pic']['name'];            //Stores the filetype e.g image/jpeg
                            $imagetype = $_FILES['pic']['type'];            //Stores any error codes from the upload.
                            $imageerror = $_FILES['pic']['error'];          //Stores the tempname as it is given by the host when uploaded.
                            $imagetemp = $_FILES['pic']['tmp_name'];

                            if(is_uploaded_file($imagetemp)) {
                                if(move_uploaded_file($imagetemp, $imagePath . $imagename)) {
                                    echo "<span hidden>Sussecfully uploaded your image.</span>";
                                }
                                else {
                                    echo "<span hidden>Failed to move your image.</span>";
                                }
                            }
                            else {
                                echo "<span hidden>Failed to upload your image.</span>";
                            }
                            echo "<div><img src='/kp/tmp/".$imagename."'></div>";
                        ?> 
                    </div>
                    <div class="mainText">
                        <?php 
                            $text = $_POST['mainText'];
                            $text = str_replace("\r\n","</p><p>", $text);
                            echo "<p>".$text."</p>";
                        ?>
                        <script>
                            var allP = document.getElementsByClassName('mainText')[0].getElementsByTagName('p');
                            var emptyP = allP[(allP.length-1)].innerText;
                            if (emptyP == "" || emptyP == " ") {
                                allP[(allP.length-1)].remove();
                            }
                            else {
                                console.log("error");
                            }
                        </script>
                        <?php
                        if(mb_strlen($text, 'utf-8') >= 1000){
                            echo '</div><div class="pagebreak"><span class="printHide">Переход на следующую страницу ↓</span></div><div class="chapter exp">&nbsp;</div>';
                        } else {
                            echo '</div>';
                        }
                        ?>
                    <?php
                        $imagenameItems = $_FILES['items']['name'];  
                        $imagetypeItems = $_FILES['items']['type'];      
                        $imageerrorItems = $_FILES['items']['error'];    
                        $imagetempItems = $_FILES['items']['tmp_name'];
                        $countArr = count($imagenameItems)-1;
                        while ($countArr >= 0) {
                            if(is_uploaded_file($imagetempItems[$countArr])) {
                                if(move_uploaded_file($imagetempItems[$countArr], $imagePath . $imagenameItems[$countArr])) {
                                    echo "<span hidden>Sussecfully uploaded your image.</span>";
                                }
                                else {
                                    echo "<span hidden>Failed to move your image.</span>";
                                }
                                $countArr--;
                            }
                            else {
                                echo "<span hidden>Failed to upload your image.</span>";
                            }
                        }
                    ?>
                    <table class="clear table-items">
                        <thead>
                        </thead>
                        <tbody>
                            <tr>
                                <?php
                                    $countArr = count($imagenameItems)-1;
                                    $countItemTop = 0;
                                    $countItemBottom = 0;
                                    while ($countItemTop <= $countArr) {
                                        if (($countItemTop+1)%4 != 0) {
                                            $path_parts = pathinfo('/kp/tmp/'.$imagenameItems[$countItemTop]);
                                            echo "<th><span>Арт. ".$path_parts['filename']."</span></th>";
                                            $countItemTop++;
                                        } else {
                                            $path_parts = pathinfo('/kp/tmp/'.$imagenameItems[$countItemTop]);
                                            echo "<th><span>Арт. ".$path_parts['filename']."</span></th>";
                                            $countItemTop++;
                                            break;
                                        }
                                    }
                                ?>
                            </tr>
                            <tr>
                                <?php
                                    $countArr = count($imagenameItems)-1;
                                    while ($countItemBottom <= $countArr) {
                                        if (($countItemBottom+1)%4 != 0) {
                                            echo "<td><img src='/kp/tmp/".$imagenameItems[$countItemBottom]."'></td>";
                                            $countItemBottom++;
                                        } else {
                                            echo "<td><img src='/kp/tmp/".$imagenameItems[$countItemBottom]."'></td>";
                                            $countItemBottom++;
                                            break;
                                        }
                                    }
                                ?>
                            </tr>
                            <tr>
                                <?php
                                    while ($countItemTop <= $countArr) {
                                        if (($countItemTop+1)%4 != 0) {
                                            $path_parts = pathinfo('/kp/tmp/'.$imagenameItems[$countItemTop]);
                                            echo "<th><span>Арт. ".$path_parts['filename']."</span></th>";
                                            $countItemTop++;
                                        } else {
                                            $path_parts = pathinfo('/kp/tmp/'.$imagenameItems[$countItemTop]);
                                            echo "<th><span>Арт. ".$path_parts['filename']."</span></th>";
                                            $countItemTop++;
                                            break;
                                        }
                                    }
                                ?>
                            </tr>
                            <tr>
                                <?php
                                    while ($countItemBottom <= $countArr) {
                                        if (($countItemBottom+1)%4 != 0) {
                                            echo "<td><img src='/kp/tmp/".$imagenameItems[$countItemBottom]."'></td>";
                                            $countItemBottom++;
                                        } else {
                                            echo "<td><img src='/kp/tmp/".$imagenameItems[$countItemBottom]."'></td>";
                                            $countItemBottom++;
                                            break;
                                        }
                                    }
                                ?>
                            </tr>
                            <tr>
                                <?php
                                    while ($countItemTop <= $countArr) {
                                        if (($countItemTop+1)%4 != 0) {
                                            $path_parts = pathinfo('/kp/tmp/'.$imagenameItems[$countItemTop]);
                                            echo "<th><span>Арт. ".$path_parts['filename']."</span></th>";
                                            $countItemTop++;
                                        } else {
                                            $path_parts = pathinfo('/kp/tmp/'.$imagenameItems[$countItemTop]);
                                            echo "<th><span>Арт. ".$path_parts['filename']."</span></th>";
                                            $countItemTop++;
                                            break;
                                        }
                                    }
                                ?>
                            </tr>
                            <tr>
                                <?php
                                    while ($countItemBottom <= $countArr) {
                                        if (($countItemBottom+1)%4 != 0) {
                                            echo "<td><img src='/kp/tmp/".$imagenameItems[$countItemBottom]."'></td>";
                                            $countItemBottom++;
                                        } else {
                                            echo "<td><img src='/kp/tmp/".$imagenameItems[$countItemBottom]."'></td>";
                                            $countItemBottom++;
                                            break;
                                        }
                                    }
                                ?>
                            </tr>
                            <tr>
                                <?php
                                    while ($countItemTop <= $countArr) {
                                        if (($countItemTop+1)%4 != 0) {
                                            $path_parts = pathinfo('/kp/tmp/'.$imagenameItems[$countItemTop]);
                                            echo "<th><span>Арт. ".$path_parts['filename']."</span></th>";
                                            $countItemTop++;
                                        } else {
                                            $path_parts = pathinfo('/kp/tmp/'.$imagenameItems[$countItemTop]);
                                            echo "<th><span>Арт. ".$path_parts['filename']."</span></th>";
                                            $countItemTop++;
                                            break;
                                        }
                                    }
                                ?>
                            </tr>
                            <tr>
                                <?php
                                    while ($countItemBottom <= $countArr) {
                                        if (($countItemBottom+1)%4 != 0) {
                                            echo "<td><img src='/kp/tmp/".$imagenameItems[$countItemBottom]."'></td>";
                                            $countItemBottom++;
                                        } else {
                                            echo "<td><img src='/kp/tmp/".$imagenameItems[$countItemBottom]."'></td>";
                                            $countItemBottom++;
                                            break;
                                        }
                                    }
                                ?>
                            </tr>
                            <tr>
                                <?php
                                    while ($countItemTop <= $countArr) {
                                        if (($countItemTop+1)%4 != 0) {
                                            $path_parts = pathinfo('/kp/tmp/'.$imagenameItems[$countItemTop]);
                                            echo "<th><span>Арт. ".$path_parts['filename']."</span></th>";
                                            $countItemTop++;
                                        } else {
                                            $path_parts = pathinfo('/kp/tmp/'.$imagenameItems[$countItemTop]);
                                            echo "<th><span>Арт. ".$path_parts['filename']."</span></th>";
                                            $countItemTop++;
                                            break;
                                        }
                                    }
                                ?>
                            </tr>
                            <tr>
                                <?php
                                    while ($countItemBottom <= $countArr) {
                                        if (($countItemBottom+1)%4 != 0) {
                                            echo "<td><img src='/kp/tmp/".$imagenameItems[$countItemBottom]."'></td>";
                                            $countItemBottom++;
                                        } else {
                                            echo "<td><img src='/kp/tmp/".$imagenameItems[$countItemBottom]."'></td>";
                                            $countItemBottom++;
                                            break;
                                        }
                                    }
                                ?>
                            </tr>
                        </tbody>
                    </table>
                    <div class="linkToOtherItems">
                        Всю палитру можно посмотреть по ссылке: <?php echo "<a href='".$linkToItems."'>".$linkToItems."</a>";?>
                    </div>
                </div>
            </div>
            <div class="pagebreak"><span class="printHide">Переход на следующую страницу ↓</span></div>
            <div class="chapter exp">&nbsp;</div>
            <table class="table-features">
                <thead>
                    <tr>
                        <th><span style="width:100%;display:block;border:1px solid #bbb;">Технические характеристики <?php echo $collectionName.":";?></span></th>
                    </tr>
                </thead>
                <tbody>
                    <tr style="padding:0;">
                        <?php
                        $collection = $_POST['featuresCollection'];
                        echo "<td style='padding:2px 1px;'><img width='100%' src='/kp/features/$collection'></td>";
                        ?>
                    </tr>
                </tbody>
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
                        <th>Цена в <?php echo "<span class='$curencyClass'>$curency</span>"?></th>
                        <th>Сумма, в <?php echo "<span class='$curencyClass'>$curency</span>"?><br>с НДС</th>
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
                        $thirdMainValue = $mainMaterial["$counterRow, $counterCol"];
                        $counterCol++;
                        $fourthMainValue = $mainMaterial["$counterRow, $counterCol"];
                        $counterCol++;
                        $fifthMainValue = $mainMaterial["$counterRow, $counterCol"];
                        $sixthMainValue = $thirdMainValue * $fifthMainValue;
                        
                        $sumSixthMainValue += $sixthMainValue;
                        $thirdMainValue = number_format($thirdMainValue, 2, ',', ' ');
                        $fifthMainValue = number_format($fifthMainValue, 2, ',', ' ');
                        $sixthMainValue = number_format(($sixthMainValue), 2, ',', ' ');
                        
                        $counterRow++;
                        $highArrMainMat--;
                        
                        echo "<tr>
                            <th>$firstMainValue</th>
                            <td>$secondMainValue</td>
                            <td>$thirdMainValue</td>
                            <td>$fourthMainValue</td>
                            <td>$fifthMainValue</td>
                            <td>$sixthMainValue</td>
                        </tr>";
                    }
                    if ($highArrMainMat < 0) {
                        $sumSixthMainValue = number_format($sumSixthMainValue, 2, ',', ' ');
                        echo "<tr>
                            <th class='sum' colspan='5'>Итого в <span class='$curencyClass'>$curency</span>, с НДС:</th>
                            <th class='sum'>$sumSixthMainValue</th>
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
                        <th>Цена в <?php echo "<span class='rub'>руб.</span>"?></th>
                        <th>Сумма, в <?php echo "<span class='rub'>руб.</span>"?><br>с НДС</th>
                    </tr>
                </thead>
                <tbody>
                    <?php
                    $counterRow=0;
                    $counter=0;
                    $sumSixthMainValue=0;
                    
                    while ($highArrAdditMat >= 0) {
                        $counterCol=0;
                        $firstMainValue = ++$posMaterialCounter;
                        $counterCol++;
                        $secondMainValue = $additionalMaterial["$counterRow, $counterCol"];
                        $counterCol++;
                        $thirdMainValue = $additionalMaterial["$counterRow, $counterCol"];
                        $counterCol++;
                        $fourthMainValue = $additionalMaterial["$counterRow, $counterCol"];
                        $counterCol++;
                        $fifthMainValue = $additionalMaterial["$counterRow, $counterCol"];
                        $sixthMainValue = $thirdMainValue * $fifthMainValue;
                        
                        $sumSixthMainValue += $sixthMainValue;
                        $thirdMainValue = number_format($thirdMainValue, 2, ',', ' ');
                        $fifthMainValue = number_format($fifthMainValue, 2, ',', ' ');
                        $sixthMainValue = number_format(($sixthMainValue), 2, ',', ' ');
                        
                        $counterRow++;
                        $highArrAdditMat--;
                        
                        echo "<tr>
                            <th>$firstMainValue.</th>
                            <td>$secondMainValue</td>
                            <td>$thirdMainValue</td>
                            <td>$fourthMainValue</td>
                            <td>$fifthMainValue</td>
                            <td>$sixthMainValue</td>
                        </tr>";
                    }
                    if ($highArrAdditMat < 0) {
                        $sumSixthMainValue = number_format($sumSixthMainValue, 2, ',', ' ');
                        echo "<tr>
                            <th class='sum' colspan='5'>Итого в <span class='rub'>руб.</span>, с НДС:</th>
                            <th class='sum'>$sumSixthMainValue</th>
                        </tr>";
                    }
                    ?>
                </tbody>
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
<!--            <div id="mail" class="mail">-->
            <?php //echo $managerEmail;?>
<!--
            </div>
            <div id="site" class="site"><a href="https://www.gelster.ru">www.gelster.ru</a></div>
            <div id="name" class="name">
-->
            <?php //echo $managerName;?>
<!--
            </div>
            <div id="phone" class="phone">+7 (499) 600-45-60 <br>+7 (985) 761-05-32</div>
-->
<!--            <div class="counter_page">1</div>-->
        </footer>
    </div>
</body>

</html>
