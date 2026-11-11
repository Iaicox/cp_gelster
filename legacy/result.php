<?php
header('Content-Type: text/html; charset=utf-8');
include 'simple_html_dom.php';
$arrContextOptions = array(
	"ssl" => array(
		"verify_peer" => false,
		"verify_peer_name" => false,
	),
);
?>
<!DOCTYPE html>
<html lang="ru">
<?php
error_reporting(E_ERROR | E_PARSE);
// error_reporting(~0);
// ini_set('display_errors', 1);
// echo ini_get('allow_url_open');
$client = $_POST['client'];
?>
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title><?php echo "КП_".$client."_от_".date("d.m.y");?></title>
	<link rel="icon" type="image/png" href="/img/icon.png"/>
	<link rel="manifest" href="/manifest.webmanifest">
	<link rel="stylesheet" href="style/style.css">
	<script src="style/jquery/jquery-3.3.1.min.js"></script>
	<script src="localStorageDB.js"></script>
</head>

<?php
	// $dir = "C:/ОБМЕН ФАЙЛАМИ/Сайт ooogelingen/www/kp/tmp/";
	// $files = scandir( $dir );
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
	$choosenFlooring = $_POST['chooseKindOfFlooring'];
	$choosenCharMain = $_POST['chooseKindChar'];
	$choosenCharSub = $_POST['chooseKindChar2'];
	$choosenFabric = $_POST['chooseFabric'];
	$clientName = $_POST['clientName'];
	$clientSex = $_POST['clientSex'];
	$linkToItems = $_POST['linkToItems'];
	$managerEmail = $_POST['email'];
	$managerName = $_POST['name'];
	$collectionName = $_POST['collectionName'];
	$htmlData = file_get_contents($linkToItems, false, stream_context_create($arrContextOptions));
	$euroRate = $_POST['euroRate'];

	$euroRate = str_replace(',','.',$euroRate);
	$euroRate = floatval($euroRate);

	// var_dump($linkToItems);
	// var_dump(stream_context_create($arrContextOptions));
	// var_dump(file_get_contents($linkToItems, false, stream_context_create($arrContextOptions)));
?>

<body>
	<div hidden>
		<?php
			$htmlNew = str_get_html($htmlData);

			# $pos1 = strpos($htmlData, 'breadcrambs">');
			# $tableStr = substr($htmlData, $pos1);
			# $htmlData = explode('</main>', $tableStr)[0];

			if ($htmlNew->innertext!='') {
				foreach($htmlNew->find('h1') as $element) {
					echo $element."\r\n";
				}
				foreach($htmlNew->find('h2') as $element) {
					echo $element."\r\n";
				}
				foreach($htmlNew->find('.entry-text') as $element) {
					echo $element."\r\n";
				}
				foreach($htmlNew->find('#collapseExample') as $element) {
					echo $element."\r\n";
				}
				foreach($htmlNew->find('.entry-photo') as $element) {
					echo $element."\r\n";
				}
				foreach($htmlNew->find('.collection-container') as $element) {
					echo $element."\r\n";
				}
				foreach($htmlNew->find('.art_item') as $element) {
					echo $element."\r\n";
				}
				foreach($htmlNew->find('.caracter-table') as $element) {
					echo $element."\r\n";
				}
			}
		?>
	</div>
	<span contenteditable="false" class="mark mark-header"><hr></span>
	<span contenteditable="false" class="mark mark-content-1"><hr></span>
	<!-- <span contenteditable="false" class="mark mark-footer"><hr></span> -->

	<div class="container">
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
					<span>Коммерческое предложение на поставку <span class='lowercase flooring_name flooring_name-first'></span> <span class="capitalize fabric_name"></span></span>
				</div>

				<div class="intro-footing">
					<span>Уважаем<?php echo $clientSex === 'm' ? 'ый' : 'ая' ; ?> <?php echo $clientName."!";?></span>
				</div>
			</div>

			<div class="mainContent">
				<div class="mainContent-heading">
					<p>Предлагаю Вам к рассмотрению <span class="lowercase flooring_name"></span>, а также сопутствующие материалы к нему.</p>
				</div>

				<div class="collection-name-block">
					<span class='kind-of-flooring'><span><span class='flooring_name'></span></span>&nbsp;&mdash;&nbsp;<span class='collection-name capitalize'></span></span>
				</div>

				<div class="mainContent-text">
					<div class="mainContent-img">
						<div class="main_img_wrapper"></div>
					</div>

					<div class="mainText"></div>

					<div class="clear table_items-wrapper"></div>

					<div class="linkToOtherItems">
						<span>Всю палитру можно посмотреть по ссылке: <?php echo "<a href='".$linkToItems."'>".$linkToItems."</a>";?></span>
					</div>
				</div>
			</div>

			<div class="br"></div>

			<table class="table-features">
				<thead>
					<tr>
						<th><span>Технические характеристики <span class="capitalize" id="featuresHeader"></span>:</span></th>
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
				$highArrMainMat = count($mainMaterial ?? array());
				$highArrAdditMat = count($additionalMaterial ?? array());
				$sumSixthMainValue=0;
				$posMaterialCounter=0;
			?>

			<table id="mainTable" class="table-main_materials" style="<?php if (!($mainMaterial)) { echo "display: none;"; } ?>">
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
					for ($i = 0; $i < $highArrMainMat; $i++) {
						$counterCol = 0;
						$firstMainValue = $mainMaterial[$i][$counterCol++];
						$secondMainValue = $mainMaterial[$i][$counterCol++];
						$thirdMainValue = str_replace(' ', '', $mainMaterial[$i][$counterCol++]);
						$fourthMainValue = $mainMaterial[$i][$counterCol++];
						$sixthMainValue = str_replace(' ', '', $mainMaterial[$i][$counterCol++]);
						$seventhMainValue = $thirdMainValue * $sixthMainValue;

						if ($mainCur) {
							$fifthMainValue = $sixthMainValue / $euroRate;
							$fifthMainValue = number_format($fifthMainValue, 2, ',', ' ');
						}

						$sumSixthMainValue += $seventhMainValue;
						$thirdMainValue = number_format($thirdMainValue, 2, ',', ' ');
						$sixthMainValue = number_format(($sixthMainValue), 2, ',', ' ');
						$seventhMainValue = number_format(($seventhMainValue), 2, ',', ' ');

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

					$sumSixthMainValueFin = number_format($sumSixthMainValue, 2, ',', ' ');
					echo "
						<tfoot>
							<tr>
								<th class='sum' colspan='$mainColSpan'>Итого в <span class='rub'>руб.</span>, с НДС:</th>
								<th class='sum'>$sumSixthMainValueFin</th>
							</tr>
						</tfoot>
					";
					$posMaterialCounter = $firstMainValue;
					?>
				</tbody>
			</table>

			<div class="br" style="<?php if (!($mainMaterial)) { echo "display: none;"; } ?>"></div>

			<table id="extraTable" class="table-addit_materials" style="<?php if (!($additionalMaterial)) { echo "display: none;"; } ?>">
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
						$sumSixthExtraValue = 0;

						for ($i = 0; $i < $highArrAdditMat; $i++) {
							$counterCol = 1;
							$firstExtraValue = ++$posMaterialCounter;
							$secondExtraValue = $additionalMaterial[$i][$counterCol++];
							$thirdExtraValue = str_replace(' ', '', $additionalMaterial[$i][$counterCol++]);
							$fourthExtraValue = $additionalMaterial[$i][$counterCol++];
							$sixthExtraValue = str_replace(' ', '', $additionalMaterial[$i][$counterCol++]);
							$seventhExtraValue = $thirdExtraValue * $sixthExtraValue;

							if ($extraCur) {
								$fifthExtraValue = $sixthExtraValue / $euroRate;
								$fifthExtraValue = number_format($fifthExtraValue, 2, ',', ' ');
							}

							$sumSixthExtraValue += $seventhExtraValue;
							$thirdExtraValue = number_format($thirdExtraValue, 2, ',', ' ');
							$sixthExtraValue = number_format(($sixthExtraValue), 2, ',', ' ');
							$seventhExtraValue = number_format(($seventhExtraValue), 2, ',', ' ');

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

						$sumSixthExtraValueFin = number_format($sumSixthExtraValue, 2, ',', ' ');
						echo "
							<tfoot>
								<tr>
									<th class='sum' colspan='$extraColSpan'>Итого в <span class='rub'>руб.</span>, с НДС:</th>
									<th class='sum'>$sumSixthExtraValueFin</th>
								</tr>
							</tfoot>
						";
					?>
				</tbody>
			</table>

			<div class="br" style="<?php if (!($additionalMaterial)) { echo "display: none;"; } ?>"></div>

			<table class="table-sum_tables" style="<?php if (!($additionalMaterial) && !($mainMaterial)) { echo "display: none;"; } ?>">
				<thead>
					<tr>
						<th>Общая сумма по позициям в <span class='rub'>руб.</span>, с НДС:</th>
						<th><?php echo number_format($sumSixthMainValue + $sumSixthExtraValue, 2, ',', ' ');?></th>
					</tr>
				</thead>
			</table>

			<div class="br" style="<?php if (!($additionalMaterial) && !($mainMaterial)) { echo "display: none;"; } ?>"></div>

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
						echo "<span class='comment'>&mdash;$commentText[$commentTextCounter]</span><div class='br'></div>";
						$commentTextCounter++;
					}
				}
			?>
		</main>

		<div id="toChooseItems" contenteditable="false">
			<input type="button" value="Выбрать все" class="items_accept items-choose_all" onclick="chooseAll();">
			<input type="button" value="Отменить выбор" class="items_accept items-choose_none" onclick="chooseNone();">
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
		document.addEventListener('DOMContentLoaded', showItems);

		var collectionName = document.getElementsByTagName('h1')[0].innerHTML.toLowerCase(),
			flooringName = document.getElementsByTagName('h2')[1].innerHTML,
			itemText1 = document.getElementsByClassName('entry-text')[0].innerHTML,
			itemText2 = '',
			mainImgSrc = document.getElementsByClassName('entry-photo')[0].children[0],
			itemContainer = document.getElementsByClassName('collection-container')[0],
			items = itemContainer.getElementsByClassName('col-auto'),
			itemSrc = document.getElementsByClassName('art_item'),
			mainText,
			srcSeparator = window.location.host,
			pageBreak = document.createElement('div'),
			chapter = document.createElement('div'),
			featuresTable = document.getElementsByClassName('caracter-table')[0],
			fabricName = items[0].children[0].children[0] ? items[0].children[0].children[0].src.split('/')[3] : items[0].children[0].src.split('/')[3],
			euroRate = <?php echo $euroRate?>;

		if (document.getElementsByClassName('collapse')[0]) {
			itemText2 = document.getElementsByClassName('collapse')[0].innerHTML;
		}

		if ((document.getElementsByClassName('entry-text')[0].nextElementSibling) && (document.getElementsByClassName('entry-text')[0].nextElementSibling.className == 'collapse')) {
			itemText2 = document.getElementsByClassName('entry-text')[0].nextElementSibling.innerHTML;
		}
		pageBreak.className = 'pagebreak';
		chapter.className = 'chapter';
		pageBreak.innerHTML = '&nbsp;';
		chapter.innerHTML = '&nbsp;';

		mainText = itemText1 + itemText2;

		mainImgSrc.src = mainImgSrc.src.split(srcSeparator)[0] + 'www.ooogelingen.ru' + mainImgSrc.src.split(srcSeparator)[1];
		document.getElementsByClassName('entry-photo')[0].children[0].src = mainImgSrc.src;
		featuresTable.children[0].children[0].remove();

		/*    Склонение в родит. падеже заголовка    */
		var rodPadArr = flooringName.split(' '),
			nominal_i = ['линолеум','натуральный','универсальный','коммерческий','спортивный','акустический','противоскользящий','противоскользящие','токопроводящий','сценический','гетерогенный','гомогенный','покрытие','покрытия','мармолеум','плитка','плитка-пвх','пвх-плитка','подложка','настенное','пробковое','пробковая','спортивный','паркет','резиновое','иглопробивной','ковролин','петлевой','петлевая','модульная','ковровая','плинтус','напольный','широкий','белый','деревянный','гибкий','мягкий','высокий','эластичный','коннелюрный','раздельный','толстый','цветной','хдф-плинтус','пвх-плинтус','накладки','накладка','завершающий','профиль','химия','строительная','ровнитель','грубый','финишный','грунтовка','клей','разметка','спортивная','краска','мастика','очиститель','потолки','подвесные','решетка','решетки','грязезащита','ковер','коврик','коврики','мат','маты','ковры','финские','модульные','грязезащитный','грязезащитные','придверная','придверные','алюминиевый','алюминиевые','металлическая','металлические','стальная','стальные', 'кварц-виниловая'],
			nominal_r = ['линолеума','натурального','универсального','коммерческого','спортивного','акустического','противоскользящего','противоскользящих','токопроводящего','сценического','гетерогенного','гомогенного','покрытия','покрытий','мармолеума','плитки','плитки-пвх','пвх-плитки','подложки','настенного','пробкового','пробковой','спортивного','паркета','резинового','иглопробивного','ковролина','петлевого','петлевой','модульной','ковровой','плинтуса','напольного','широкого','белого','деревянного','гибкого','мягкого','высокого','эластичного','коннелюрного','раздельного','толстого','цветного','хдф-плинтуса','пвх-плинтуса','накладок','накладки','завершающего','профиля','химии','строительной','ровнителя','грубого','финишного','грунтовки','клея','разметки','спортивной','краски','мастики','очистителя','потолков','подвесных','решетки','решеток','грязезащиты','ковра','коврика','ковриков','мата','матов','ковров','финских','модульных','грязезащитного','грязезащитных','придверной','придверных','алюминиевого','алюминиевых','металлической','металлических','стальной','стальных', 'кварц-виниловой'];

		for (var i=0; i<rodPadArr.length; i++) {
			var idPad = nominal_i.indexOf(rodPadArr[i].toLowerCase());

			if (idPad != -1) {
				rodPadArr[i] = nominal_r[idPad];
			}
		}

		rodPadArr = rodPadArr.join(' ');

		for (var i=0; i<document.getElementsByClassName('flooring_name').length; i++) {
			document.getElementsByClassName('flooring_name')[i].innerHTML = flooringName;
			document.getElementsByClassName('flooring_name-first')[0].innerHTML = rodPadArr;
		}
		/*    /Склонение в родит. падеже заголовка    */

		document.getElementsByClassName('fabric_name')[0].innerHTML = fabricName;
		document.getElementsByClassName('collection-name')[0].innerHTML = collectionName;
		document.getElementsByClassName('main_img_wrapper')[0].innerHTML = mainImgSrc.outerHTML;
		document.getElementsByClassName('mainText')[0].innerHTML = mainText;

		/*    Артикулы    */

		function setItemsOnPage(items) {
			var usefulItems = [],
				requestItems = [],
				itemsTableTrImg = '',
				itemsTableTrDesc = '',
				itemsTableContainer = document.getElementsByClassName('table_items-wrapper')[0],
				fullItemsTable = '';

			for (var i = 0; i < items.length; i++) {
				usefulItems[i] = items[i].children[0].outerHTML;
				requestItems[i] = items[i].children[3].innerText;
			}

			itemsTableContainer.innerHTML = '';

			fullItemsTable += '<table class="table-items"><tbody>';

			for (var i = 0; i < requestItems.length;) {

				itemsTableTrImg = "<tr>";
				itemsTableTrDesc = "<tr>";

				for (var j = 0; j < 4; j++, i++) {
					if (i < requestItems.length) {
						itemsTableTrImg += '<td class="art_item">' + usefulItems[i] + '</td>';
						itemsTableTrDesc += '<th><span>Арт. ' + requestItems[i] + '</th>';
					}
				}

				itemsTableTrImg += "</tr>";
				itemsTableTrDesc += "</tr>";

				if (((i % 16) == 0) && (i !== requestItems.length)) {
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

		function acceptChoosenItems() {
			var itemContainer = document.getElementsByClassName('choose_items_container')[0],
				itemsList = itemContainer.getElementsByTagName('input'),
				choosenItems = [];
			for (var i = 0; i < itemsList.length; i++) {
				var check = itemsList[i].checked;

				if (check) {
					choosenItems.push(itemsList[i].parentNode);
				}
			}
			if (choosenItems.length) {
				document.getElementById('toChooseItems').style.display = 'none';
				return (choosenItems);
			} else if (changingOnPage.curItems != undefined) {
				var labels = itemContainer.getElementsByTagName('label');
				for (var i=0; i<labels.length; i++) {
					for (var j=0; j<changingOnPage.curItems.length; j++) {
						if (labels[i].innerHTML == changingOnPage.curItems[j]) {
							choosenItems.push(labels[i]);
						}
					}
				}
				return (choosenItems);
			} else {
				alert("Вы не выбрали ни одного артикула.");
			}
		}

		function addToChooseItems() {
			document.getElementById('toChooseItems').style.display = 'block';
		}

		/*    /Артикулы    */

		/*    Талица характеристик    */
		var curFeaturesTable = document.getElementsByClassName('table-features')[0],
			curFeaturesTableTd = curFeaturesTable.getElementsByTagName('td');
		document.getElementById('featuresHeader').innerText += collectionName;
		curFeaturesTable.children[1].innerHTML = featuresTable.innerHTML;
		fixFeaturesColSpan();
		for (var i=0; i<curFeaturesTableTd.length; i++) {
			curFeaturesTableTd[i].ondblclick = delFeature;
			curFeaturesTableTd[i].title = "Дважды кликните по элементу для удаления";
		}
		curFeaturesTable.getElementsByTagName('th')[0].title = "Дважды клинкните для корректировки длины заголовка";
		curFeaturesTable.getElementsByTagName('th')[0].ondblclick = fixFeaturesColSpan;
		/*      /Талица характеристик    */

		function showItems() {
			var itemContainer = document.getElementsByClassName('choose_items_container')[0],
				itemsListSrc = document.getElementsByClassName('collection-container'),
				itemsList = [],
				srcSeparator = window.location.host;

			for (var i = 0; i < itemsListSrc.length; i++) {
				for (var j = 0; j < itemsListSrc[i].getElementsByClassName('col-auto').length; j++) {
					itemsList.push(itemsListSrc[i].getElementsByClassName('col-auto')[j]);
				}
			}

			for (var i = 0; i < itemsList.length; i++) {
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

			for (var i = 0; i < document.getElementsByClassName('choose_items_container')[0].getElementsByTagName('img').length; i++) {
				document.getElementsByClassName('choose_items_container')[0].getElementsByTagName('img')[i].ondragstart = function() {
					return false;
				};
			}

			setTimeout( function() {
				if (!Object.keys(changingOnPage).length == 0) {
					loadProject();
				}
			}, 100);
		}

		function chooseAll() {
			var items = document.getElementsByClassName('choose_items_container')[0].getElementsByTagName('input');

			for (var i = 0; i < items.length; i++) {
				items[i].checked = true;
			}
		}

		function chooseNone() {
			var items = document.getElementsByClassName('choose_items_container')[0].getElementsByTagName('input');

			for (var i = 0; i < items.length; i++) {
				items[i].checked = false;
			}
		}

		function delFeature(elem) {
			elem.target.style.display = 'none';
		}

		function fixFeaturesColSpan() {
			var maxColSpan = 2;
			for (var i=0; i<curFeaturesTable.getElementsByTagName('tr').length; i++) {
				if (curFeaturesTable.getElementsByTagName('tr')[i].children.length > maxColSpan) {maxColSpan = curFeaturesTable.getElementsByTagName('tr')[i].children.length;}
			}
			curFeaturesTable.getElementsByTagName('th')[0].setAttribute('colspan', maxColSpan);
		};
	</script>

	<script>
		/*  вставка pagebreak   */
		var PX2MM = 3.7794,
				fullHeightMM = 297,
				headerHeightMM = 52.5,
				footerHeightMM = 17.5,
				gapPX = 30,
				gapMM = gapPX / PX2MM,
				contentHeightMM = fullHeightMM - headerHeightMM - footerHeightMM - gapMM,
				fullHeightPX = fullHeightMM * PX2MM,
				headerHeightPX = headerHeightMM * PX2MM,
				footerHeightPX = footerHeightMM * PX2MM,
				contentHeightPX = fullHeightPX - headerHeightPX - footerHeightPX - gapPX,
				centerX = document.documentElement.clientWidth / 2,
				needToScroll,
				breaksCounter = 0,
				pastePageBreak,
				pastePageBreakParent;

		function markContentHeight() {
			var docHeightPX = Math.max(
						document.body.scrollHeight, document.documentElement.scrollHeight,
						document.body.offsetHeight, document.documentElement.offsetHeight,
						document.body.clientHeight, document.documentElement.clientHeight
					),
					timesToPaste = parseInt((docHeightPX - headerHeightPX - footerHeightPX) / (contentHeightPX + gapPX)),
					allMarks = document.querySelectorAll('.mark'),
					lastMark = allMarks[allMarks.length - 1],
					spanMark = document.createElement('span')

			spanMark.innerHTML = '<hr>'
			spanMark.className = 'mark'

			if (timesToPaste > 1) {
				for (var i = 2; i <= timesToPaste; i++) {
					spanMark.className += ' mark-content-' + i
					spanMark.style.top = headerHeightMM + gapMM + contentHeightMM * i + 'mm'
					spanMark.contenteditable = 'false'
					let newMark = spanMark.cloneNode(true)
					lastMark.after(newMark)
					lastMark = newMark
					// document.body.insertBefore(spanMark.cloneNode(true), lastMark)
				}
			}
		}

		let tableItemsWrapperEth = tableFeaturesWrapperEth = mainTableWrapperEth = extraTableWrapperEth = null
		const temporaryNodesArray = []

		function PastePageBreak() {
			tableItemsWrapperEth = document.querySelector('.table-items')
			tableFeaturesWrapperEth = document.querySelector('.table-features')
			mainTableWrapperEth = document.querySelector('#mainTable')
			extraTableWrapperEth = document.querySelector('#extraTable')

			function InsertBreaks() {
				if (pastePageBreak.localName === 'div' && pastePageBreak.className === 'br') {
					pastePageBreak.nextElementSibling?.className === 'comment'
					const node = pastePageBreak.nextElementSibling
					node.before(pageBreak.cloneNode(true))
					node.before(chapter.cloneNode(true))
					return
				}
				if (pastePageBreak.localName === 'span' && pastePageBreak.className !== 'comment')
					pastePageBreak = pastePageBreak.parentElement

				if (['td', 'th', 'img'].includes(pastePageBreak.localName)) {
					let tr = tbody = table = pastePageBreak
					while (tr.localName !== 'tr')
						tr = tr.parentElement
					table = tr.parentElement.parentElement

					if (tr.parentElement.localName !== 'thead') {
						tbody = tr.parentElement
						let newTableTop = table.cloneNode(false)
						let newTableBot = table.cloneNode(false)
						if (table.tHead)
							newTableTop.append(table.tHead.cloneNode(true))
						if (table.tFoot)
							newTableBot.append(table.tFoot.cloneNode(true))

						if (tbody.localName === 'tbody') {
							const newTbody = document.createElement('tbody')
							const tbodyChildren = [...tbody.children]
							const trIndex = tbodyChildren.indexOf(tr)
							if (!trIndex) {
								newTableBot = table.cloneNode(true)
								newTableTop = null
							} else if (trIndex > 0) {
								newTableTop.append(newTbody.cloneNode(true))
								newTableBot.prepend(newTbody.cloneNode(true))
								tbodyChildren.splice(0, trIndex).forEach(node => {
									if (!newTableTop.tBodies.length) {
										const body = document.createElement('tbody')
										newTableTop.append(body)
									}
									newTableTop.tBodies[0].append(node.cloneNode(true))
								})
								tbodyChildren.forEach(node => {
									if (!newTableBot.tBodies.length) {
										const body = document.createElement('tbody')
										newTableBot.append(body)
									}
									newTableBot.tBodies[0].append(node.cloneNode(true))
								})
							} else {
								if (table.tHead && !table.tFoot) {
									tbodyChildren.splice(0, trIndex + 1).forEach(node => {
										if (!newTableTop.tBodies.length) {
											const body = document.createElement('tbody')
											newTableTop.append(body)
										}
										newTableTop.tBodies[0].append(node.cloneNode(true))
									})
									tbodyChildren.forEach(node => {
										if (!newTableBot.tBodies.length) {
											const body = document.createElement('tbody')
											newTableBot.append(body)
										}
										newTableBot.tBodies[0].append(node.cloneNode(true))
									})
									if (!newTableBot.tBodies[0].children.length)
										newTableBot = null
								} else {
									newTableTop = null
									newTableBot.prepend(tbody.cloneNode(true))
									if (table.tHead)
										newTableBot.prepend(table.tHead.cloneNode(true))
								}
							}
						} else {
							if (table.tBodies.length)
								newTableTop.append(table.tBodies[0].cloneNode(true))
						}

						if (newTableTop) {
							table.parentElement.insertBefore(newTableTop, table)
							temporaryNodesArray.push(newTableTop)
						}
						if (newTableBot){
							table.parentElement.insertBefore(newTableBot, table)
							temporaryNodesArray.push(newTableBot)
						}
						table.remove()

						if (newTableBot)
							pastePageBreak = newTableBot
						else
							pastePageBreak = newTableTop

					} else
						pastePageBreak = table
				}

				if (pastePageBreak?.previousElementSibling?.localName === 'h3')
					pastePageBreak = pastePageBreak.previousElementSibling

				pastePageBreak.before(pageBreak.cloneNode(true))
				pastePageBreak.before(chapter.cloneNode(true))
			}

			var content = document.querySelector('.content'),
					footer = document.querySelector('footer'),
					marks = document.querySelectorAll('.mark')

			footer.style.display = 'none'
			document.body.style.background = '#fff'

			var docHeight = Math.max(
						document.body.scrollHeight, document.documentElement.scrollHeight,
						document.body.offsetHeight, document.documentElement.offsetHeight,
						document.body.clientHeight, document.documentElement.clientHeight
					),
					winHeight = document.documentElement.clientHeight,
					scale = winHeight / docHeight

			document.body.style.transform = 'scale('+scale+')'
			content.scrollIntoView(true)
			const markList = document.querySelectorAll('.mark')
			// markList[markList.length - 1].hidden = true

			let prevPoint = null
			while (breaksCounter > -1) {
				const element = markList[breaksCounter + 1]
				if (!element) {
					breaksCounter = -1
					break
				}
				const rectObj = element.getBoundingClientRect()
				let point = 0
				if (!prevPoint)
					point = rectObj.top
				else {
					prevPoint = document.querySelectorAll('.pagebreak')?.[breaksCounter - 1]?.getBoundingClientRect()?.top ?? prevPoint
					point = prevPoint  + (contentHeightPX + gapPX) * scale
				}

				element.hidden = true
				pastePageBreak = document.elementFromPoint(document.documentElement.clientWidth / 2, point)
				// if (breaksCounter > 0)
				// 	pastePageBreak = document.elementFromPoint(centerX, document.querySelectorAll('.pagebreak')[breaksCounter - 1].getBoundingClientRect().top + (contentHeightPX + gapPX) * scale)
				// else
				// 	pastePageBreak = document.elementFromPoint(centerX, (contentHeightPX + gapPX) * scale)

				if (!pastePageBreak || pastePageBreak.localName === 'html') {
					breaksCounter = -1
					break
				} else
					InsertBreaks()

				prevPoint = point
				breaksCounter++
			}

			footer.style.display = ''
			document.body.style.transform = ''
			if (marks.length)
				[...marks].forEach(node => node.hidden = false)
		}
		/*  /вставка pagebreak   */

		function getPageBreaks() {
			tableItemsWrapperTemp = document.querySelector('.table-items')
			tableFeaturesWrapperTemp = document.querySelector('.table-features')
			mainTableWrapperTemp = document.querySelector('#mainTable')
			extraTableWrapperTemp = document.querySelector('#extraTable')

			tableItemsWrapperTemp.parentElement.insertBefore(tableItemsWrapperEth, tableItemsWrapperTemp)
			tableFeaturesWrapperTemp.parentElement.insertBefore(tableFeaturesWrapperEth, tableFeaturesWrapperTemp)
			mainTableWrapperTemp.parentElement.insertBefore(mainTableWrapperEth, mainTableWrapperTemp)
			extraTableWrapperTemp.parentElement.insertBefore(extraTableWrapperEth, extraTableWrapperTemp)
			temporaryNodesArray.forEach(node => node.remove())
			temporaryNodesArray.length = 0

			document.body.style.background = '#aaa'
			breaksCounter = 0
			const nodes = document.querySelectorAll('.pagebreak, .chapter')
			if (nodes.length)
				[...nodes].forEach(node => node.remove())
		}
	</script>
	<script>
		function createCaretPlacer(atStart) {
			return function(el) {
				el.focus();
				if (typeof window.getSelection != "undefined" &&
					typeof document.createRange != "undefined") {
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

		function SetDesignMode() {
			var arrDesignMode = ['p', 'img', 'td', 'th', 'span', 'h1', 'h2', 'h3', 'ul', 'ol', 'table'];
			for (var i = 0; i < arrDesignMode.length; i++) {
				setEdit(arrDesignMode[i]);
			}
		}
		SetDesignMode();

		function setEdit(elem) {
			$(elem)
				.click(function(e) {
					if ($(e.currentTarget).attr('contenteditable') === 'true') return;
					$(e.currentTarget).attr('contenteditable', 'true');
					if ($(e.currentTarget)[0].localName == 'p') {
						$(e.currentTarget)[0].style.display = 'table';
					}
					placeCaretAtEnd(e.currentTarget);
				})
				.blur(function(e) {
					$(e.currentTarget).attr('contenteditable', 'false');
					if ($(e.currentTarget)[0].localName == 'p') {
						$(e.currentTarget)[0].style.display = 'block';
					}
					if ($(e.currentTarget)[0].getElementsByTagName('br').length>0) {
						$(e.currentTarget)[0].getElementsByTagName('br')[0].remove();
					}
				});
		}
	</script>
	<script>
		/*Работа с базой данных*/

		var curProjectName = `<?php echo $client; ?>`;
		var changingOnPage = ((obj_db.get(curProjectName, function(value) {
					if (value) {
						changingOnPage = value;
					}
				})) || ({})),
			changedElems = ['intro','mainContent-heading','collection-name-block','mainText','table-features'],
			curItems = [],
			curItemsTh = [],
			curItemsThInner = [];

		function saveProject() {
			for (var i=0; i<changedElems.length; i++) {
				changingOnPage[changedElems[i]] = document.getElementsByClassName(changedElems[i])[0].innerHTML;
			}
			curItems = acceptChoosenItems();
			curItemsTh = document.getElementsByClassName('table-items')[0].getElementsByTagName('th');
			for (var i=0; i<curItems.length; i++) {
				curItems[i] = curItems[i].innerHTML;
				curItemsThInner[i] = curItemsTh[i].innerHTML;
			}

			changingOnPage.curItems = curItems;
			changingOnPage.curItemsThInner = curItemsThInner;
			obj_db.set(curProjectName, changingOnPage);
		}

		function loadProject() {
			var label = document.createElement('label'),
				curItemsClone = [];
			curItems = changingOnPage.curItems;
			curItemsThInner = changingOnPage.curItemsThInner;
			for (var i=0; i<curItems.length; i++) {
				curItemsClone[i] = label.cloneNode();
				curItemsClone[i].innerHTML = curItems[i];
			}
			var settingItemsOnPage = setItemsOnPage(curItemsClone);
			curItems = curItemsClone;
			curItemsTh = document.getElementsByClassName('table-items')[0].getElementsByTagName('th');
			for (var i=0; i<curItemsThInner.length; i++) {
				if (curItemsTh[i]) {
					curItemsTh[i].innerHTML = curItemsThInner[i];
				}
			}
			for (key in changingOnPage) {
				if ((key == 'curItems') || (key == 'curItemsThInner')) {} else {
					document.getElementsByClassName(key)[0].innerHTML = changingOnPage[key];
				}
			}
			document.getElementById('toChooseItems').style.display = 'none';
			var setDesignMode = SetDesignMode();
		}
	</script>

	<button onclick="PastePageBreak(); window.print(); getPageBreaks();" style="position:fixed; top:50px; right:100px; padding:10px; cursor:pointer; border-radius:15px; border:0; z-index: 100;">Сохранить в PDF</button>
	<button onclick="saveProject();" style="position:fixed; top:50px; left:100px; padding:10px; cursor:pointer; border-radius:15px; border:0; z-index: 100;">Сохранить изменения<br>в проекте</button>
	<button onclick="obj_db.del(curProjectName);" style="position:fixed; top:110px; left:100px; padding:10px; cursor:pointer; border-radius:15px; border:0; z-index: 100;">Удалить сохраненные<br>изменения</button>
	<button onclick="addToChooseItems();" style="position:fixed; top:200px; left:100px; padding:10px; cursor:pointer; border-radius:15px; border:0; z-index: 100;">Добавить артикулы</button>
	<button onclick="chooseNone();addToChooseItems();" style="position:fixed; top:250px; left:100px; padding:10px; cursor:pointer; border-radius:15px; border:0; z-index: 100;">Перевыбрать артикулы</button>
</body>

</html>