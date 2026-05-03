require('dotenv').config();
const { 
    Client, 
    GatewayIntentBits, 
    Events, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    ActionRowBuilder, 
    EmbedBuilder, 
    ButtonBuilder, 
    ButtonStyle,
    PermissionFlagsBits,
    ChannelType,
    MessageFlags
} = require('discord.js');
const db = require('./database');

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent 
    ] 
});

const config = {
    token: process.env.TOKEN,
    ordersChannelId: process.env.ORDERS_CHANNEL_ID,
    pendingCatId: process.env.PENDING_CAT_ID,
    progressCatId: process.env.PROGRESS_CAT_ID,
    completedCatId: process.env.COMPLETED_CAT_ID,
    reviewsChannelId: process.env.REVIEWS_CHANNEL_ID,
    portfolioChannelId: process.env.PORTFOLIO_CHANNEL_ID,
    logChannelId: process.env.LOG_CHANNEL_ID,
    adminRoleName: process.env.ADMIN_ROLE_NAME || 'admin prem',
    customerRoleName: process.env.CUSTOMER_ROLE_NAME || 'customer',
    maxActiveOrders: parseInt(process.env.MAX_ACTIVE_ORDERS) || 3
};

// Helper: Generate Short ID
function generateShortId() {
    return Math.random().toString(36).substring(2, 6).toUpperCase();
}

// Helper: Logging
async function logAction(guild, title, description, color = 0x95A5A6) {
    if (!config.logChannelId) return;
    const logChannel = await guild.channels.fetch(config.logChannelId).catch(() => null);
    if (!logChannel || !logChannel.isTextBased()) return;

    const logEmbed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(color)
        .setTimestamp();

    await logChannel.send({ embeds: [logEmbed] });
}

client.once(Events.ClientReady, c => {
    console.log(`Ready! Logged in as ${c.user.tag}`);
});

const pendingAttachments = new Map();

client.on(Events.InteractionCreate, async interaction => {
    // 1. Slash Command /order
    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'order') {
            const hasRole = interaction.member.roles.cache.some(r => r.name === config.adminRoleName);
            if (!hasRole) return interaction.reply({ content: 'Only staff can create orders.', flags: MessageFlags.Ephemeral });

            const attachment = interaction.options.getAttachment('reference');
            
            // Store attachment URL temporarily (customId has 100 char limit)
            if (attachment) pendingAttachments.set(interaction.user.id, attachment.url);
            
            const modal = new ModalBuilder()
                .setCustomId('order_modal')
                .setTitle('Create Order');

            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('order_price').setLabel("Price").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('order_service').setLabel("Service Type").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('order_prompt').setLabel("Description").setStyle(TextInputStyle.Paragraph).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('order_notes').setLabel("Notes / Deadline").setStyle(TextInputStyle.Short).setRequired(false))
            );

            await interaction.showModal(modal);
        }

        if (interaction.commandName === 'review') {
            const hasRole = interaction.member.roles.cache.some(r => r.name === config.customerRoleName);
            if (!hasRole) return interaction.reply({ content: 'Only customers can submit reviews.', flags: MessageFlags.Ephemeral });

            const employee = interaction.options.getUser('employee');
            const modal = new ModalBuilder().setCustomId(`review_modal:${employee.id}`).setTitle('Submit Review');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('review_rating').setLabel("Rating (1-5)").setStyle(TextInputStyle.Short).setMaxLength(1).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('review_feedback').setLabel("Feedback").setStyle(TextInputStyle.Paragraph).setRequired(true))
            );
            await interaction.showModal(modal);
        }

        if (interaction.commandName === 'portfolio') {
            const modal = new ModalBuilder()
                .setCustomId('portfolio_modal')
                .setTitle('Submit Portfolio');

            const usernameInput = new TextInputBuilder()
                .setCustomId('portfolio_username')
                .setLabel("Your Username")
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('e.g. Designer#1234')
                .setRequired(true);

            const descInput = new TextInputBuilder()
                .setCustomId('portfolio_description')
                .setLabel("Experience & Bio")
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('Tell us about your experience and how long you have been working...')
                .setRequired(true);

            const linkInput = new TextInputBuilder()
                .setCustomId('portfolio_link')
                .setLabel("Portfolio Link")
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('https://behance.net/...')
                .setRequired(true);

            modal.addComponents(
                new ActionRowBuilder().addComponents(usernameInput),
                new ActionRowBuilder().addComponents(descInput),
                new ActionRowBuilder().addComponents(linkInput)
            );

            await interaction.showModal(modal);
        }
    }

    // 2. Modal Submission
    if (interaction.isModalSubmit()) {
        const { customId, fields, user, guild } = interaction;

        if (customId === 'order_modal') {
            const attachmentUrl = pendingAttachments.get(user.id);
            pendingAttachments.delete(user.id); // Clean up
            
            const price = fields.getTextInputValue('order_price');
            const service = fields.getTextInputValue('order_service');
            const prompt = fields.getTextInputValue('order_prompt');
            const notes = fields.getTextInputValue('order_notes') || 'None';
            const orderId = generateShortId();

            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            try {
                const forumChannel = await guild.channels.fetch(config.ordersChannelId).catch(() => null);
                if (!forumChannel) return interaction.editReply({ content: 'Forum channel not found.' });

                const embed = new EmbedBuilder()
                    .setTitle(`New Order | ID: ${orderId}`)
                    .setColor(0x3498DB)
                    .addFields(
                        { name: 'Service', value: service, inline: true },
                        { name: 'Price', value: price, inline: true },
                        { name: 'Staff', value: user.toString(), inline: true },
                        { name: 'Description', value: prompt },
                        { name: 'Notes/Deadline', value: notes }
                    )
                    .setFooter({ text: 'Status: Available' })
                    .setTimestamp();

                if (attachmentUrl) embed.setImage(attachmentUrl);

                const post = await forumChannel.threads.create({
                    name: `AVAILABLE | ${service} (${orderId})`,
                    message: {
                        embeds: [embed],
                        components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('take_order').setLabel('Take Order').setStyle(ButtonStyle.Primary))]
                    }
                });

                const ticket = await guild.channels.create({
                    name: `ticket-${orderId}-${service.toLowerCase().replace(/\s+/g, '-')}`,
                    type: ChannelType.GuildText,
                    parent: config.pendingCatId,
                    permissionOverwrites: [
                        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                        { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
                    ],
                });

                // DB Entry
                db.createOrder({
                    shortId: orderId,
                    staffId: user.id,
                    price,
                    service,
                    description: prompt,
                    attachmentUrl,
                    forumPostId: post.lastMessageId,
                    ticketChannelId: ticket.id
                });

                const summaryEmbed = new EmbedBuilder()
                    .setTitle(`Order Summary | ${orderId}`)
                    .setColor(0x3498DB)
                    .addFields(
                        { name: 'Service', value: service, inline: true },
                        { name: 'Price', value: price, inline: true },
                        { name: 'Staff', value: user.toString(), inline: true },
                        { name: 'Details', value: prompt }
                    );
                if (attachmentUrl) summaryEmbed.setImage(attachmentUrl);

                await ticket.send({ embeds: [summaryEmbed] });
                await interaction.editReply({ content: `Order ${orderId} created. Post: ${post} | Ticket: ${ticket}` });
                await logAction(guild, 'Order Created', `Order ${orderId} created by ${user.tag}. Service: ${service}`, 0x3498DB);

            } catch (e) {
                console.error(e);
                await interaction.editReply({ content: 'Error creating order.' });
            }
        }

        if (customId.startsWith('review_modal:')) {
            const employeeId = customId.split(':')[1];
            const rating = parseInt(fields.getTextInputValue('review_rating'));
            const feedback = fields.getTextInputValue('review_feedback');

            if (isNaN(rating) || rating < 1 || rating > 5) return interaction.reply({ content: 'Rating must be 1-5.', flags: MessageFlags.Ephemeral });

            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            try {
                const reviewsChannel = await guild.channels.fetch(config.reviewsChannelId).catch(() => null);
                const employee = await guild.members.fetch(employeeId).catch(() => null);

                const reviewEmbed = new EmbedBuilder()
                    .setTitle('New Review')
                    .setColor(0xF1C40F)
                    .addFields(
                        { name: 'Customer', value: user.toString(), inline: true },
                        { name: 'Employee', value: employee ? employee.toString() : 'Unknown', inline: true },
                        { name: 'Rating', value: `${rating}/5`, inline: true },
                        { name: 'Feedback', value: feedback }
                    );

                db.createReview({ customerId: user.id, employeeId, rating, feedback });
                await reviewsChannel.send({ embeds: [reviewEmbed] });
                await interaction.editReply({ content: 'Review submitted!' });
                await logAction(guild, 'Review Submitted', `Review by ${user.tag} for ${employee ? employee.user.tag : 'Unknown'}. Rating: ${rating}/5`, 0xF1C40F);
            } catch (e) {
                console.error(e);
                await interaction.editReply({ content: 'Error submitting review.' });
            }
        }

        if (customId === 'portfolio_modal') {
            const username = fields.getTextInputValue('portfolio_username');
            const description = fields.getTextInputValue('portfolio_description');
            const link = fields.getTextInputValue('portfolio_link');

            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            try {
                const portfolioChannel = await guild.channels.fetch(config.portfolioChannelId).catch(() => null);
                if (!portfolioChannel || !portfolioChannel.isTextBased()) {
                    return interaction.editReply({ content: 'Portfolio channel not configured correctly.' });
                }

                const portfolioEmbed = new EmbedBuilder()
                    .setTitle(`${username}'s Portfolio`)
                    .setColor(0x9B59B6)
                    .addFields(
                        { name: 'About/Experience', value: description },
                        { name: 'Link', value: link }
                    )
                    .setFooter({ text: `Submitted by ${user.tag}` })
                    .setTimestamp();

                await portfolioChannel.send({ embeds: [portfolioEmbed] });
                await interaction.editReply({ content: 'Your portfolio has been posted!' });
                await logAction(guild, 'Portfolio Posted', `${user.tag} posted their portfolio.`, 0x9B59B6);

            } catch (e) {
                console.error(e);
                await interaction.editReply({ content: 'Error posting portfolio.' });
            }
        }
    }

    // 3. Buttons
    if (interaction.isButton()) {
        const { customId, guild, channel, user, message, member } = interaction;

        if (customId === 'take_order') {
            const order = db.getOrderByMsgId(message.id);
            if (!order) return interaction.reply({ content: 'Order not found in database.', flags: MessageFlags.Ephemeral });

            const activeCount = db.getActiveOrdersCount(user.id);
            if (activeCount >= config.maxActiveOrders) {
                return interaction.reply({ content: `You have reached the limit of ${config.maxActiveOrders} active orders.`, flags: MessageFlags.Ephemeral });
            }

            const ticket = await guild.channels.fetch(order.ticket_channel_id).catch(() => null);
            if (!ticket) return interaction.reply({ content: 'Ticket channel not found.', flags: MessageFlags.Ephemeral });

            // Update Post
            const embed = EmbedBuilder.from(message.embeds[0]).setColor(0xE67E22).setFooter({ text: `Claimed by ${user.tag}` });
            await interaction.update({ embeds: [embed], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('claimed').setLabel('Claimed').setStyle(ButtonStyle.Secondary).setDisabled(true))] });
            if (channel.isThread()) await channel.setName(`CLAIMED | ${order.service} (${order.short_id})`).catch(() => null);

            // DB & Ticket
            db.updateOrderClaim(order.short_id, user.id);
            await ticket.setParent(config.progressCatId, { lockPermissions: false });
            await ticket.permissionOverwrites.edit(user.id, { ViewChannel: true, SendMessages: true });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('complete_order').setLabel('Complete Order').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('dispute_order').setLabel('Dispute').setStyle(ButtonStyle.Secondary)
            );

            await ticket.send({ content: `Order claimed by ${user.toString()}`, components: [row] });
            await logAction(guild, 'Order Claimed', `Order ${order.short_id} claimed by ${user.tag}`, 0xE67E22);
        }

        if (customId === 'complete_order') {
            const order = db.getOrderByTicketId(channel.id);
            if (!order) return interaction.reply({ content: 'Order record not found in database.', flags: MessageFlags.Ephemeral });

            const hasRole = member.roles.cache.some(r => r.name === config.adminRoleName);
            if (!hasRole) return interaction.reply({ content: 'Only staff can complete orders.', flags: MessageFlags.Ephemeral });

            await interaction.deferReply().catch(() => null);
            try {
                db.updateOrderStatus(order.short_id, 'COMPLETED');
                
                // 1. Archive Channel
                await channel.setParent(config.completedCatId, { lockPermissions: false }).catch(e => console.error('Move error:', e));
                
                // 2. Update Forum Post
                const forum = await guild.channels.fetch(config.ordersChannelId).catch(() => null);
                if (forum) {
                    // Fetch active and archived threads to be sure
                    const activeThreads = await forum.threads.fetchActive().catch(() => ({ threads: new Map() }));
                    const post = activeThreads.threads.find(t => t.name.includes(order.short_id));
                    if (post) {
                        await post.setName(`COMPLETED | ${order.service} (${order.short_id})`).catch(() => null);
                        if (!post.archived) await post.setArchived(true).catch(() => null);
                    }
                }

                // 3. Set Read-Only
                await channel.permissionOverwrites.edit(guild.id, { SendMessages: false }).catch(() => null);
                const overwrites = channel.permissionOverwrites.cache;
                for (const [id] of overwrites) {
                    if (id === guild.id) continue;
                    await channel.permissionOverwrites.edit(id, { SendMessages: false }).catch(() => null);
                }

                await interaction.editReply({ content: 'Order completed and archived.' }).catch(() => null);
                await logAction(guild, 'Order Completed', `Order ${order.short_id} completed by ${user.tag}`, 0x2ECC71);
            } catch (e) {
                console.error('Completion error:', e);
                await interaction.editReply({ content: 'Error during completion process.' }).catch(() => null);
            }
        }

        if (customId === 'dispute_order') {
            await interaction.reply({ content: 'Staff has been notified of the dispute. Please wait for an administrator.', flags: MessageFlags.Ephemeral });
            await logAction(guild, 'Dispute Raised', `Dispute raised in ${channel.toString()} by ${user.tag}`, 0xE74C3C);
            // Optionally ping admins in the log channel or ticket
            await channel.send({ content: `Attention @here: A dispute has been raised by ${user.toString()}.` });
        }
    }
});

client.login(config.token);
