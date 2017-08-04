/**
 *	@filename	AnyaShopBot.js
 *	@author		Legless
 *	@desc		Shopbot for Anya without a packet manipulation to move NPC to Waypoint. Base on ShopBot.js code by kolton
 */
function AnyaShopBot( ) {
	var sleep_time = 50;
	var anya;

	var cyclesText = new Text( 'Cycles: ', 50, 260, 2, 1 ),
		cyclesPerMinText = new Text( 'Cycles per minute: ', 50, 275, 2, 1 ),
		itemsText = new Text( 'Items: ', 50, 290, 2, 1 ),
		timeText = new Text( 'Time: ', 50, 305, 2, 1 ),
		stat_items_total = 0,
		stat_items_bought = 0,
		stat_cycles = 0,
		stat_start_time = 0;

	this.pickEntries = [];

	this.buildPickList = function () {
		var i, nipfile, line, lines, info,
			filepath = "pickit/shopbot.nip",
			filename = filepath.substring(filepath.lastIndexOf("/") + 1, filepath.length);

		if (!FileTools.exists(filepath)) {
			Misc.errorReport("ÿc1NIP file doesn't exist: ÿc0" + filepath);

			return false;
		}

		try {
			nipfile = File.open(filepath, 0);
		} catch (fileError) {
			Misc.errorReport("ÿc1Failed to load NIP: ÿc0" + filename);
		}

		if (!nipfile) {
			return false;
		}

		lines = nipfile.readAllLines();

		nipfile.close();

		for (i = 0; i < lines.length; i += 1) {
			info = {
				line: i + 1,
				file: filename,
				string: lines[i]
			};

			line = NTIP.ParseLineInt(lines[i], info);

			if (line) {
				this.pickEntries.push(line);
			}
		}

		return true;
	};

	this.goToAnya = function( ) {
		if (me.inTown) {
			if (!Town.goToTown(5)) {
				return false;
			}
		} else {
			if (!this.useWp(109)) {
				return false;
			}
		}

		Town.move(NPC.Anya);

		return true;
	};

	this.openPindlePortal = function( ) {
		if (!Pather.getPortal(121) && me.getQuest(37, 1)) {
			anya = getUnit(1, NPC.Anya);

			if (anya) {
				anya.openMenu();
				me.cancel();
			}
		}

		return true;
	}

	this.usePortal = function( ) {
		if( !Pather.usePortal( 121 ) ) {
			throw new Error("Failed to use Pindle portal.");
			return false;
		}

		delay( sleep_time );
		Pather.usePortal( 109 );
		delay( sleep_time );

		return true;
	};

	this.openMenu = function (npc) {
		if (npc.type !== 1) {
			throw new Error("Unit.openMenu: Must be used on NPCs.");
		}

		var i, tick,
			interactedNPC = getInteractedNPC();

		if (interactedNPC && interactedNPC.name !== npc.name) {
			sendPacket(1, 0x30, 4, interactedNPC.type, 4, interactedNPC.gid);
			me.cancel();
		}

		if (getUIFlag(0x08)) {
			return true;
		}

		for (i = 0; i < 10; i += 1) {
			if (getDistance(me.x, me.y, npc.x, npc.y) > 5) {
				Pather.walkTo(npc.x, npc.y);
			}

			if (!getUIFlag(0x08)) {
				sendPacket(1, 0x13, 4, 1, 4, npc.gid);
				sendPacket(1, 0x2f, 4, 1, 4, npc.gid);
			}

			tick = getTickCount();

			while (getTickCount() - tick < Math.max(Math.round((i + 1) * 250 / (i / 3 + 1)), me.ping + 1)) {
				if (getUIFlag(0x08)) {
					//print("openMenu try: " + i);

					return true;
				}

				delay(10);
			}
		}

		me.cancel();

		return false;
	};

	this.shopItems = function (npc, menuId) {
		var i, item, items, bought;

		if (!Storage.Inventory.CanFit({sizex: 2, sizey: 4}) && AutoMule.getMuleItems().length > 0) {
			D2Bot.printToConsole("Mule triggered");
			scriptBroadcast("mule");
			scriptBroadcast("quit");

			return true;
		}

		if (!npc) {
			return false;
		}

		for (i = 0; i < 10; i += 1) {
			delay(150);

			if (i % 2 === 0) {
				sendPacket(1, 0x38, 4, 1, 4, npc.gid, 4, 0);
			}

			if (npc.itemcount > 0) {
				//delay(200);

				break;
			}
		}

		item = npc.getItem();

		if (!item) {
			return false;
		}

		items = [];

		do {
			if (Config.ShopBot.ScanIDs.indexOf(item.classid) > -1 || Config.ShopBot.ScanIDs.length === 0) {
				items.push(copyUnit(item));
			}
		} while (item.getNext());

		stat_items_total += items.length;
		me.overhead(npc.itemcount + " items, " + items.length + " valid");

		for (i = 0; i < items.length; i += 1) {
			if (Storage.Inventory.CanFit(items[i]) && Pickit.canPick(items[i]) &&
					me.gold >= items[i].getItemCost(0) &&
					NTIP.CheckItem(items[i], this.pickEntries)
					) {
				beep();
				D2Bot.printToConsole("Match found!", 7);
				delay(1000);

				if (npc.startTrade(menuId)) {
					Misc.logItem("Shopped", items[i]);
					items[i].buy();

					bought = true;
					stat_items_bought++;
				}

				if (Config.ShopBot.QuitOnMatch) {
					scriptBroadcast("quit");
				}
			}
		}

		if (bought) {
			me.cancel();
			Town.stash();
		}

		return true;
	};

	this.showStats = function( ) {
		var time = getTickCount( ) -  stat_start_time;

		cyclesText.text = 'Cycles: ' + stat_cycles;
		cyclesPerMinText.text = 'Cycles per minute: ' + ( stat_cycles / ( time / 1000 / 60 ) ).toFixed( 2 );
		itemsText.text = 'Items: ' + stat_items_bought + '/' +  stat_items_total;
		timeText.text = 'Time: ' + ( time / 1000 / 60 ).toFixed( 0 ) + ' min';
	};

	stat_start_time = getTickCount( );

	this.buildPickList( );
	Town.doChores( );
	this.goToAnya( );
	this.openPindlePortal( );

	anya = getUnit( 1, NPC.Anya );

	while( this.usePortal( ) ) {
		this.openMenu( anya );
		this.shopItems( anya, 'Shop' );

		this.showStats( );

		stat_cycles++;
	}

	return true;
}