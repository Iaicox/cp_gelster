<!DOCTYPE html>
<html lang="ru">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Заполните форму КП</title>
    <link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.3.1/css/bootstrap.min.css" integrity="sha384-ggOyR0iXCbMQv3Xipma34MD+dH/1fQ784/j6cY/iJTQUOhcWr7x9JvoRxT2MZw1T" crossorigin="anonymous">
    <link rel="stylesheet" href="style/style.css">
    <script src="https://code.jquery.com/jquery-3.3.1.min.js"></script>
    <script async src="https://cdnjs.cloudflare.com/ajax/libs/popper.js/1.14.7/umd/popper.min.js" integrity="sha384-UO2eT0CpHqdSJQ6hJty5KVphtPhzWj9WO1clHTMGa3JDZwrnQq4sF86dIHNDz0W1" crossorigin="anonymous"></script>
    <script async src="https://stackpath.bootstrapcdn.com/bootstrap/4.3.1/js/bootstrap.min.js" integrity="sha384-JjSmVgyd0p3pXB1rRibZUAYoIIy6OrQ6VrjIEaFf/nJGzIxFDsf4x0xIM+B07jRM" crossorigin="anonymous"></script>
</head>

<body>
    <div class="container p-0">
        <header class="header">
            <div class="divHeader"><img class="header_img" src="style/header.jpg"></div>
        </header>
        <main class="content">
            <form id="KP" action="result.php" enctype="multipart/form-data" method="post">
                <h1>Заполни форму:</h1>
                <input type="hidden" name="maxFileSize" value="30000">
                <fieldset>
                    <legend>Выбрать ФИО менеджера</legend>
                    <select name="chooseManager">
                        <option value="michael_smu.jpg">Михаил Смущенко</option>
                        <option value="andrew_stanc.jpg">Андрей Станцель</option>
                        <option value="eugenia_aley.jpg">Евгения Алейникова</option>
                        <option value="ivan_log.jpg">Иван Логинов</option>
                        <option value="andrew_sluf.jpg">Андрей Слуфенков</option>
                    </select>
                </fieldset><br>
<!--
                <label>Ваши имя и фамилия: <input class="beginingForm" type="text" name="name" placeholder="Ваше имя и фамилия"></label><br>
                <label>Ваша рабоочая почта: <input class="beginingForm"  type="email" name="email" placeholder="Ваша почта"><br></label>
-->
                <label>Название компании, с которой работаете: <input class="beginingForm"  type="text" name="client" placeholder="Название компании или ИП"><br></label>
                <label>Имя контактного лица: <input class="beginingForm"  type="text" name="clientName" placeholder="Имя контактного лица"><br></label>
                <label>Название предлагаемой коллекции: <input class="beginingForm"  type="text" name="collectionName" placeholder="Название коллекции"><br></label>
                <label>Ссылка на коллекцию на сайте: <input class="beginingForm"  type="url" name="linkToItems" placeholder="Ссылка на страницу на сайте"><br></label>
                <fieldset>
                    <legend>Какой материал поставляется</legend>
                    <select name="chooseKindChar">
                        <option value=" "> - </option>
                        <option value="коммерческий">Коммерческий</option>
                        <option value="бытовой">Бытовой</option>
                        <option value="петлевой">Петлевой</option>
                        <option value="иглопробивной">Иглопробивной</option>
                        <option value="гибкий">Гибкий</option>
                        <option value="коннелюрный">Коннелюрный</option>
                    </select>
                    <select name="chooseKindChar2">
                        <option value=" "> - </option>
                        <option value="гетерогенный">Гетерогенный</option>
                        <option value="гомогенный">Гомогенный</option>
                        <option value="токопроводящий">Токопроводящий</option>
                        <option value="токорассеивающий">Токорассеивающий</option>
                        <option value="противоскользящий">Противоскользящий</option>
                        <option value="акустический">Акустический</option>
                        <option value="эластичный">Эластичный</option>
                        <option value="цветной">Цветной</option>
                    </select>
                    <select name="chooseKindOfFlooring">
                        <option value="линолеум">Линолеум</option>
                        <option value="плитка ПВХ">Плитка ПВХ</option>
                        <option value="натуральный линолеум">Натуральный линолеум</option>
                        <option value="спортивный линолеум">Спортивный линолеум</option>
                        <option value="сценический линолеум">Сценический линолеум</option>
                        <option value="ковровая плитка">Ковровая плитка</option>
                        <option value="ковролин">Ковролин</option>
                        <option value="напольный плинтус">Напольный плинтус</option>
                        <option value="грязезащитные ковры">Грязезащитные ковры</option>
                        <option value="резиновое покрытие">Резиновое покрытие</option>
                        <option value="настенное покрытие">Настенное покрытие</option>
                        <option value="профиль для ступеней">Профиль для ступеней</option>
                        <option value="завершающий профиль">Завершающий профиль</option>
                        <option value="строительная химия">Строительная химия</option>
                        <option value="средства за уходом за покрытиями">Средства за уходом за покрытиями</option>
                        <option value="клей для напольных покрытий">Клей для напольных покрытий</option>
                        <option value="подвесные потолки">Подвесные потолки</option>
                    </select>
                </fieldset>
                <fieldset>
                    <legend>Материал какой фабрики поставляется</legend>
                    <select name="chooseFabric">
                        <option value="Forbo">Forbo</option>
                        <option value="Grabo">Grabo</option>
                        <option value="Gerflor">Gerflor</option>
                        <option value="Tarkett">Tarkett</option>
                        <option value="IVC">IVC</option>
                        <option value="Синтелон">Синтелон</option>
                        <option value="Balsan">Balsan</option>
                        <option value="Desso">Desso</option>
                        <option value="Dollken">Dollken</option>
                        <option value="Grace">Grace</option>
                        <option value="Алсагор">Алсагор</option>
                        <option value="Eurocol">Eurocol</option>
                        <option value="Резипол">Резипол</option>
                        <option value="AMF">AMF</option>
                        <option value="Ecophon">Ecophon</option>
                        <option value="Armstrong">Armstrong</option>
                        <option value="Rockfon">Rockfon</option>
                    </select>
                </fieldset>
                <fieldset>
                    <legend>Выбери картинку покрытия в интерьере для примера</legend>
                    <input type="file" name="pic"><br>
                </fieldset>
                <fieldset>
                    <legend>Выбери картинки предлагаемых артикулов</legend>
                    <input type="file" name="items[]" multiple><br>
                </fieldset><br>
                <label>
                Текст описания колекции: <br>
                <textarea name="mainText" id="mainText" cols="60" rows="10" placeholder="Введите основной текст описания коллекций."></textarea>
                </label><br>
                <fieldset>
                    <legend>Технические характеристики <br> <small><i>Выбери коллекцию</i></small></legend>
                    <select name="featuresCollection">
                        <option value="kp_mipolam.jpg">Mipolam</option>
                        <option value="Marmoleum;">Marmoleum</option>
                        <option value="Sportline">Sportline</option>
                    </select>
                </fieldset>
                <fieldset>
                    <legend>Выбери валюту расчета стоимости основных материалов</legend>
                    <label><input name="curency" value="евро" type="radio">Евро</label><br>
                    <label><input name="curency" value="руб." type="radio">Рубли</label>
                </fieldset>
                <fieldset>
                    <legend>Какие основные материалы:</legend>
                    <div style="position:relative;margin-bottom:20px;" id="mainPositions">
                        <div id="mainBlockItem1">
                            <label><input class="list-counter" name="mainMaterial[0, 0]" type="text" readonly value="1."></label>
                            <label><input class="list-name" name="mainMaterial[0, 1]" placeholder="Наименование" type="text"></label>
                            <label><input class="list-number" name="mainMaterial[0, 2]" placeholder="Кол-во" type="text"></label>
                            <label>
                                <select name="mainMaterial[0, 3]">
                                    <option value="шт.">шт.</option>
                                    <option value="м&sup2;">м&sup2;</option>
                                    <option value="пог.м">пог.м</option>
                                </select>
                            </label>
                            <label><input class="list-price" name="mainMaterial[0, 4]" placeholder="Цена в выбранной валюте" type="text"></label><br>
                        </div>
                        <div id="mainBlockItem2"></div>
                        <input title="Добавить позицию" type="button" value="+" style="padding:5px 3px;font-size:30px;line-height:15px;vertical-align:top;position:absolute;top:0;left:-50px;width:30px;" onclick="addMainPosition();">
                        <input title="Удалить позицию" type="button" value="&ndash;" style="padding:5px 3px;font-size:30px;line-height:15px;vertical-align:top;position: absolute;top:32px;left:-50px;width:30px;" onclick="delMainPosition();">
                    </div>
                </fieldset>
                <script>
                    var mainPositionsCount=1;
                    var mainPositionsCountCols=0;
                    var mainPosFullBlock;
                    var mainPositionParent;
                    var mainCounter=2;
                    
                    function addMainPosition() {
                        var mainPosFirstCol = '<label><input class="list-counter" name="mainMaterial['+mainPositionsCount+', '+mainPositionsCountCols+']" type="text" readonly value="'+(mainPositionsCount+1)+'."></label>';
                        var mainPosSecondCol = '<label><input class="list-name" name="mainMaterial['+mainPositionsCount+', '+(mainPositionsCountCols+1)+']" placeholder="Наименование" type="text"></label>';
                        var mainPosThirdCol = '<label><input class="list-number" name="mainMaterial['+mainPositionsCount+', '+(mainPositionsCountCols+2)+']" placeholder="Кол-во" type="text"></label>';
                        var mainPosFourthCol = '<label> \
                                <select name="mainMaterial['+mainPositionsCount+', '+(mainPositionsCountCols+3)+']"> \
                                    <option value="шт.">шт.</option> \
                                    <option value="м&sup2;">м&sup2;</option> \
                                    <option value="пог.м">пог.м</option> \
                                </select> \
                            </label>';
                        var mainPosFifthCol = '<label><input class="list-price"  name="mainMaterial['+mainPositionsCount+', '+(mainPositionsCountCols+4)+']" placeholder="Цена в выбранной валюте" type="text"></label><br>';
                        var nextMainElem = document.createElement('div');
                        nextMainElem.id = 'mainBlockItem'+(mainCounter+1);
                        
                        mainPosFullBlock = mainPosFirstCol +' '+ mainPosSecondCol +' '+ mainPosThirdCol +' '+ mainPosFourthCol +' '+ mainPosFifthCol;
                        
                        mainPositionParent = document.getElementById('mainBlockItem'+mainCounter).innerHTML += mainPosFullBlock;
                        
                        document.getElementById('mainBlockItem'+mainCounter).after(nextMainElem);
                        
                        mainCounter++;
                        mainPositionsCount++;
                    }
                    function delMainPosition() {
                        if (mainCounter == 1) {
                            alert("Больше нечего удалять!");
                            return;
                        }
                        
                        if (mainCounter != 1) {
                            document.getElementById('mainBlockItem'+mainCounter).remove();
                        }
                        mainCounter--;
                        document.getElementById('mainBlockItem'+mainCounter).remove();
                        
                        if (mainCounter != 1) {
                            var nextMainElem = document.createElement('div');
                            nextMainElem.id = 'mainBlockItem'+(mainCounter);
                            
                            document.getElementById('mainBlockItem'+(mainCounter-1)).after(nextMainElem);
                        }
                        
                        mainPositionsCount--;
                        
                        if (mainCounter == 1) {
                            var nextMainElem = '<div id="mainBlockItem1"></div>';
                            
                            document.getElementById('mainPositions').innerHTML += nextMainElem;
                        }
                    }
                </script>
                <fieldset>
                    <legend>Какие дополнительные материалы:</legend>
                    <div style="position:relative;" id="additionalPositions">
                        <div id="blockItem1">
                            <label><input class="list-counter" name="additionalMaterial[0, 0]" type="text" readonly value="1."></label>
                            <label><input class="list-name" name="additionalMaterial[0, 1]" placeholder="Наименование" type="text"></label>
                            <label><input class="list-number" name="additionalMaterial[0, 2]" placeholder="Кол-во" type="text"></label>
                            <label>
                                <select name="additionalMaterial[0, 3]">
                                    <option value="шт.">шт.</option>
                                    <option value="м&sup2;">м&sup2;</option>
                                    <option value="пог.м">пог.м</option>
                                </select>
                            </label>
                            <label><input class="list-price" name="additionalMaterial[0, 4]" placeholder="Цена в рублях" type="text"></label><br>
                        </div>
                        <div id="blockItem2"></div>
                        <input title="Добавить позицию" type="button" value="+" style="padding:5px 3px;font-size:30px;line-height:15px;vertical-align:top;position:absolute;top:0;left:-50px;width:30px;" onclick="addAdditionalPositions();">
                        <input title="Удалить позицию" type="button" value="&ndash;" style="padding:5px 3px;font-size:30px;line-height:15px;vertical-align:top;position: absolute;top:32px;left:-50px;width:30px;" onclick="delAdditionalPositions();">
                    </div>
                </fieldset>
                <script>
                    var additionalPositionsCount=1;
                    var additionalPositionsCountCols=0;
                    var additionalPosFullBlock;
                    var additionalPositionParent;
                    var counter=2;
                    
                    function addAdditionalPositions() {
                        var additionalPosFirstCol = '<label><input class="list-counter" name="additionalMaterial['+additionalPositionsCount+', '+additionalPositionsCountCols+']" type="text" readonly value="'+(additionalPositionsCount+1)+'."></label>';
                        var additionalPosSecondCol = '<label><input class="list-name" name="additionalMaterial['+additionalPositionsCount+', '+(additionalPositionsCountCols+1)+']" placeholder="Наименование" type="text"></label>';
                        var additionalPosThirdCol = '<label><input class="list-number" name="additionalMaterial['+additionalPositionsCount+', '+(additionalPositionsCountCols+2)+']" placeholder="Кол-во" type="text"></label>';
                        var additionalPosFourthCol = '<label> \
                                <select name="additionalMaterial['+additionalPositionsCount+', '+(additionalPositionsCountCols+3)+']"> \
                                    <option value="шт.">шт.</option> \
                                    <option value="м&sup2;">м&sup2;</option> \
                                    <option value="пог.м">пог.м</option> \
                                </select> \
                            </label>';
                        var additionalPosFifthCol = '<label><input class="list-price"  name="additionalMaterial['+additionalPositionsCount+', '+(additionalPositionsCountCols+4)+']" placeholder="Цена в рублях" type="text"></label><br>';
                        var nextElem = document.createElement('div');
                        nextElem.id = 'blockItem'+(counter+1);
                        
                        additionalPosFullBlock = additionalPosFirstCol +' '+ additionalPosSecondCol +' '+ additionalPosThirdCol +' '+ additionalPosFourthCol +' '+ additionalPosFifthCol;
                        
                        additionalPositionParent = document.getElementById('blockItem'+counter).innerHTML += additionalPosFullBlock;
                        
                        document.getElementById('blockItem'+counter).after(nextElem);
                        
                        counter++;
                        additionalPositionsCount++;
                    }
                    function delAdditionalPositions() {
                        if (counter == 1) {
                            alert("Больше нечего удалять!");
                            return;
                        }
                        
                        if (counter != 1) {
                            document.getElementById('blockItem'+counter).remove();
                        }
                        
                        counter--;
                        document.getElementById('blockItem'+counter).remove();
                        
                        if (counter != 1) {
                            var nextElem = document.createElement('div');
                            nextElem.id = 'blockItem'+(counter);
                            
                            document.getElementById('blockItem'+(counter-1)).after(nextElem);
                        }
                        
                        additionalPositionsCount--;
                        
                        if (counter == 1) {
                            var nextElem = '<div id="blockItem1"></div>';
                            
                            document.getElementById('additionalPositions').innerHTML += nextElem;
                        }
                    }
                </script>
                <fieldset>
                    <legend>Комментарий по доставке</legend>
                    <label><input name="comment" value="да" type="radio">Доставка рассчитывается отдельно</label><br>
                    <label><input name="comment" value="нет" type="radio">Нет комментария</label><br>
                    <label>
                        <input name="comment" value="свой" type="radio">Другой комментарий:<br>
                        <input type="text" name="commentText">
                    </label>
                </fieldset>
                <br><input type="submit" value="Создать КП" style="padding:5px;border-radius:10px;">
            </form>
        </main>
        <footer class="footer">
            <div class="divFooter"><img class="footer_img" src="style/footer.jpg"></div>
        </footer>
    </div>
</body>

<!--
Изначально как планировалось сделать технические характеристики: 
1) Создается массив с названиями
2) Создаются инпуты с возможнустью заполнить значения
3) На страницу результата передается массив и соответсвтенно данные инпутов
4) Перебором создаются ячейки таблицы с названиями характеристик и значением
-->
<?php
    #На странице запроса
    /*global $features;
    $features = [
        'Класс применения' => '',
        'Сертификат пожарной безопасности' => '',
        'Толщина покрытия общая, (мм)' => '',
        'Толщина защитного слоя, (мм)' => '',
        'Ширина рулона, (м)' => '',
        'Намотка стандартного рулона, (м)' => '',
        'Класс противоскольжения' => '',
        'Устойчивость к хим. веществам' => '',
        'Электрическое сопротивление, Ω (Ом)' => '',
        'Вес материала' => '',
        'Дополнительное защитное покрытие' => '',
        'Стойкость цвета (ISO 105-B02)' => '',
        'Устойчивость к истиранию' => '',
    ];
    session_start();
    $countKeys = 0;
    $_SESSION["features"]=$features;
    foreach($features as $key => $value) {
        echo "<label>$key: <input type='text' name='characteristics[$countKeys]' placeholder='$key' value='$value'></label><br>";
        $countKeys++;
    }
    #На странице результата
    session_start();
    $characteristics = $_POST['characteristics'];
    $countKeys = 0;
    $countNames = 0;
    $features = $_SESSION["features"];
    #И потом перебор значений и вставка в таблицу*/
?>


</html>