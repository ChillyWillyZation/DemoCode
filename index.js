import {
    TITLE_HEIGHT,
    PAIR_HEIGHT,
    SIDE_INDENT,
    SMALL_INDENT,
    LARGE_INDENT,
    DIFFERENT_LAYERS_OFFSET,
    INITIAL_PAIR_INPUT_COUNT,
    EMPTY_PAIR_INPUT_COUNT,
    REGULAR_PAIR_INPUT_COUNT,
} from 'src/constants/tournament-tree';

const hasValue = pair => pair.value && pair.value.home && pair.value.away;

export const hasInputFromLowerLayer = pair => hasValue(pair)
    && pair.inputOtherLayout
    && pair.layer.position === 0;

export const hasInputFromUpperLayer = pair => hasValue(pair)
    && pair.inputOtherLayout
    && pair.layer.position > 0;

const hasHiddenParentRound = ({
    round,
    pairsById,
    currentSlideIndex,
}) => {
    const pairs = (round && round.pairs) || [];
    const inputIds = pairs.reduce((accum, pair) => {
        accum.push(...pair.input);

        return accum;
    }, []);

    return inputIds.some(pairId => (
        !pairsById[pairId].inputOtherLayout
        && pairsById[pairId].round.position < currentSlideIndex
    ));
};

/**
 * Возвращает плоский список раундов в колонках
 */
const getRoundsList = columns => columns.reduce(
    (roundsInPrevColumns, roundsInColumn) => {
        roundsInPrevColumns.push(...roundsInColumn);

        return roundsInPrevColumns;
    },
    [],
);

/**
 * Отступы одной пары
 */
const getPairOffset = (pairs, pairIndex) => (
    pairs.reduce((offset, pair, index) => {
        if (index === 0) {
            return SIDE_INDENT;
        }

        if (index > pairIndex) {
            return offset;
        }

        const indent = pairs[index - 1].output === pairs[index].output
            ? SMALL_INDENT
            : LARGE_INDENT;

        return offset + indent + PAIR_HEIGHT;
    }, 0)
);

/**
 * Отступы пар в первой видимой колонке
 * @return {Object}
 */
const getOffsetInFirstRound = ({ round }) => ((round && round.pairs) || [])
    .reduce((offsets, pair, index, pairs) => (
        Object.assign(offsets, { [pair.id]: getPairOffset(pairs, index) })
    ), {});

/**
 * Отступы пар во второй и последующих колонках
 * @return {Object}
 */
const getOffsetsInRightRound = ({
    round,
    offsets,
    layerHeight,
}) => ((round && round.pairs) || []).reduce((offsetsInRound, pair, index, pairs) => {
    let offset = 0;

    switch (pair.input.length) {
        case INITIAL_PAIR_INPUT_COUNT:
            offset = getPairOffset(pairs, index);
            break;
        case EMPTY_PAIR_INPUT_COUNT:
            if (hasInputFromUpperLayer(pair)) {
                offset = offsets[pair.input[0]] - DIFFERENT_LAYERS_OFFSET;
            } else if (hasInputFromLowerLayer(pair)) {
                offset = offsets[pair.input[0]] + DIFFERENT_LAYERS_OFFSET;
            } else {
                offset = offsets[pair.input[0]];
            }

            break;
        case REGULAR_PAIR_INPUT_COUNT:
            if (pair.mergingLayers) {
                offset = layerHeight - PAIR_HEIGHT;
            } else {
                offset = (offsets[pair.input[0]] + offsets[pair.input[1]]) / 2;
            }

            break;
        default:
            break;
    }

    return Object.assign(offsetsInRound, { [pair.id]: offset });
}, {});

/**
 * Отступы пар в скрытых колонках
 * @return {Object}
 */
const getOffsetsInLeftRound = ({ round, offsets }) => ((round && round.pairs) || [])
    .reduce((offsetsInRound, pair) => (
        Object.assign(offsetsInRound, { [pair.id]: offsets[pair.output] })
    ), {});

/**
 * Список колонок делится на три части: первая видимая колонка, то что правее, то что левее
 * Последовательно обходим раунды во всех трех частях и составляем словарь с отступами пар во всём дереве
 * @return {Object}
 */
export const getOffsets = ({ currentSlideIndex, tournamentTree, layerHeights }) => {
    const { columns, pairsById } = tournamentTree;

    const firstColumnRoundsList = getRoundsList([columns[currentSlideIndex]]);
    const leftColumnsRoundsList = getRoundsList(columns.slice(0, currentSlideIndex).reverse());
    const rightColumnsRoundsList = getRoundsList(columns.slice(currentSlideIndex + 1));

    const firstColumnPairsOffsets = firstColumnRoundsList.reduce((offsets, round) => (
        Object.assign(offsets, getOffsetInFirstRound({ round }))
    ), {});

    const withRightColumnsPairsOffsets = rightColumnsRoundsList.reduce((offsets, round) => {
        /**
         * Если родительский раунд скрыт под скроллом, а перед ним разрыв (битые данные),
         * то позиционируем пары такого раунда как если бы это был первый раунд
         */
        const offset = hasHiddenParentRound({ round, pairsById, currentSlideIndex })
            ? getOffsetInFirstRound({ round })
            : getOffsetsInRightRound({
                round,
                offsets,
                layerHeight: round ? layerHeights[round.layer.position] : 0,
            });

        return Object.assign(offsets, offset);
    }, firstColumnPairsOffsets);

    const withLeftAndRightColumnsPairsOffsets = leftColumnsRoundsList.reduce((offsets, round) => (
        Object.assign(offsets, getOffsetsInLeftRound({
            round,
            offsets,
        }))
    ), withRightColumnsPairsOffsets);

    const offsets = withLeftAndRightColumnsPairsOffsets;

    return offsets;
};

/**
 * Высота раунда
 */
export const getRoundHeight = round => (
    getPairOffset(round.pairs, round.pairs.length - 1)
    + TITLE_HEIGHT
    + PAIR_HEIGHT
    + SIDE_INDENT
);
