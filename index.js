require("dotenv").config();

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  MessageFlags,
  PermissionsBitField,
  RoleSelectMenuBuilder,
  UserSelectMenuBuilder,
} = require("discord.js");

const CUSTOM_IDS = {
  give: "browsergame-roles:give",
  remove: "browsergame-roles:remove",
  role: "browsergame-roles:role",
  users: "browsergame-roles:users",
  confirm: "browsergame-roles:confirm",
  cancel: "browsergame-roles:cancel",
};

const token = process.env.DISCORD_TOKEN || process.env.BOT_TOKEN;
const adminChannelId = process.env.ADMIN_CHANNEL_ID || "1512799809365606440";
const deleteOldPanel = process.env.DELETE_OLD_PANEL !== "false";

if (!token) {
  console.error("DISCORD_TOKEN oder BOT_TOKEN fehlt. Erstelle eine .env Datei oder setze die Variable beim Hoster.");
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

const sessions = new Map();

client.once(Events.ClientReady, async () => {
  console.log(`Eingeloggt als ${client.user.tag}`);

  const channel = await client.channels.fetch(adminChannelId);
  if (!channel || channel.type !== ChannelType.GuildText) {
    throw new Error("ADMIN_CHANNEL_ID muss ein normaler Textkanal auf deinem Server sein.");
  }

  if (deleteOldPanel) {
    await deletePreviousPanels(channel);
  }

  await channel.send({
    embeds: [panelEmbed()],
    components: [panelButtons()],
  });

  console.log(`Panel wurde in #${channel.name} gepostet.`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (!interaction.inCachedGuild()) return;

    if (interaction.isButton()) {
      await handleButton(interaction);
      return;
    }

    if (interaction.isRoleSelectMenu() && interaction.customId === CUSTOM_IDS.role) {
      await updateSession(interaction, { roleId: interaction.values[0] });
      return;
    }

    if (interaction.isUserSelectMenu() && interaction.customId === CUSTOM_IDS.users) {
      await updateSession(interaction, { userIds: interaction.values });
    }
  } catch (error) {
    console.error(error);
    await safeReply(interaction, "Fehler. Pruefe bitte Bot-Rechte, Rollen-Hierarchie und Kanal-ID.");
  }
});

async function handleButton(interaction) {
  if (interaction.customId === CUSTOM_IDS.cancel) {
    sessions.delete(interaction.user.id);
    await interaction.update({ content: "Abgebrochen.", embeds: [], components: [] });
    return;
  }

  if (interaction.customId === CUSTOM_IDS.confirm) {
    await confirm(interaction);
    return;
  }

  if (![CUSTOM_IDS.give, CUSTOM_IDS.remove].includes(interaction.customId)) return;

  if (!canUsePanel(interaction.member)) {
    await interaction.reply({
      content: "Du brauchst `Rollen verwalten`, um dieses Panel zu benutzen.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const mode = interaction.customId === CUSTOM_IDS.give ? "give" : "remove";
  sessions.set(interaction.user.id, { mode, roleId: null, userIds: [] });

  await interaction.reply({
    embeds: [sessionEmbed(mode)],
    components: sessionComponents(mode),
    flags: MessageFlags.Ephemeral,
  });
}

async function updateSession(interaction, patch) {
  const session = sessions.get(interaction.user.id);

  if (!session) {
    await interaction.reply({
      content: "Diese Auswahl ist abgelaufen. Klick bitte nochmal auf das Panel.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  Object.assign(session, patch);
  sessions.set(interaction.user.id, session);

  await interaction.update({
    embeds: [sessionEmbed(session.mode, session)],
    components: sessionComponents(session.mode),
  });
}

async function confirm(interaction) {
  const session = sessions.get(interaction.user.id);

  if (!canUsePanel(interaction.member)) {
    await interaction.reply({
      content: "Du brauchst `Rollen verwalten`, um dieses Panel zu benutzen.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (!session?.roleId || !session.userIds.length) {
    await interaction.reply({
      content: "Waehle erst eine Rolle und mindestens einen User aus.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferUpdate();

  const role = await interaction.guild.roles.fetch(session.roleId);
  const botMember = await interaction.guild.members.fetchMe();

  if (!role) {
    await interaction.editReply({ content: "Diese Rolle gibt es nicht mehr.", embeds: [], components: [] });
    return;
  }

  if (role.managed || role.position >= botMember.roles.highest.position) {
    await interaction.editReply({
      content: `Ich kann ${role} nicht verwalten. Zieh meine Bot-Rolle ueber diese Rolle.`,
      embeds: [],
      components: [],
    });
    return;
  }

  const lines = [];

  for (const userId of session.userIds) {
    const member = await interaction.guild.members.fetch(userId);

    if (session.mode === "give") {
      await member.roles.add(role, `Browsergame role panel by ${interaction.user.tag}`);
      lines.push(`+ ${member.user.tag}`);
    } else {
      await member.roles.remove(role, `Browsergame role panel by ${interaction.user.tag}`);
      lines.push(`- ${member.user.tag}`);
    }
  }

  sessions.delete(interaction.user.id);

  await interaction.editReply({
    content: `Fertig. Rolle: ${role}\n${lines.join("\n")}`,
    embeds: [],
    components: [],
  });
}

function panelEmbed() {
  return new EmbedBuilder()
    .setColor(0x2563eb)
    .setTitle("Browsergame Rollen")
    .setDescription("Hier kannst du Spielrollen geben oder wieder entfernen.")
    .setFooter({ text: "Nur fuer Leute mit Rollen-verwalten-Recht." });
}

function panelButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(CUSTOM_IDS.give)
      .setLabel("Rolle geben")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(CUSTOM_IDS.remove)
      .setLabel("Rolle entfernen")
      .setStyle(ButtonStyle.Danger),
  );
}

function sessionEmbed(mode, session = {}) {
  const role = session.roleId ? `<@&${session.roleId}>` : "Noch nicht ausgewaehlt";
  const users = session.userIds?.length ? session.userIds.map((id) => `<@${id}>`).join("\n") : "Noch nicht ausgewaehlt";

  return new EmbedBuilder()
    .setColor(mode === "give" ? 0x22c55e : 0xef4444)
    .setTitle(mode === "give" ? "Rolle geben" : "Rolle entfernen")
    .addFields(
      { name: "Rolle", value: role },
      { name: "User", value: users },
    );
}

function sessionComponents(mode) {
  return [
    new ActionRowBuilder().addComponents(
      new RoleSelectMenuBuilder()
        .setCustomId(CUSTOM_IDS.role)
        .setPlaceholder("Rolle suchen")
        .setMinValues(1)
        .setMaxValues(1),
    ),
    new ActionRowBuilder().addComponents(
      new UserSelectMenuBuilder()
        .setCustomId(CUSTOM_IDS.users)
        .setPlaceholder("User suchen")
        .setMinValues(1)
        .setMaxValues(25),
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(CUSTOM_IDS.confirm)
        .setLabel(mode === "give" ? "Geben" : "Entfernen")
        .setStyle(mode === "give" ? ButtonStyle.Success : ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(CUSTOM_IDS.cancel)
        .setLabel("Abbrechen")
        .setStyle(ButtonStyle.Secondary),
    ),
  ];
}

async function deletePreviousPanels(channel) {
  const messages = await channel.messages.fetch({ limit: 25 });
  const panels = messages.filter(
    (message) => message.author.id === client.user.id && message.embeds.some((embed) => embed.title === "Browsergame Rollen"),
  );

  for (const message of panels.values()) {
    await message.delete().catch(() => {});
  }
}

function canUsePanel(member) {
  return member.permissions.has(PermissionsBitField.Flags.ManageRoles);
}

async function safeReply(interaction, content) {
  const payload = { content, flags: MessageFlags.Ephemeral };

  if (interaction.deferred || interaction.replied) {
    await interaction.followUp(payload).catch(() => {});
  } else {
    await interaction.reply(payload).catch(() => {});
  }
}

client.login(token);
